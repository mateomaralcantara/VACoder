import { NextResponse } from "next/server";
import { createOrchestratorAdminClient } from "@/lib/orchestrator/admin";
import { stripeEnv } from "@/lib/billing/stripe";
import {
  subscriptionChangeFromEvent,
  verifyStripeSignature,
} from "@/lib/billing/stripe-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe llama a esta ruta sin sesion: la autenticacion es la firma del
// cuerpo. Es el unico camino por el que cambia el plan de una organizacion.
export async function POST(request: Request) {
  const env = stripeEnv();

  if (!env.webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "Falta STRIPE_WEBHOOK_SECRET." },
      { status: 503 },
    );
  }

  // La firma se calcula sobre el cuerpo exacto: no usar request.json().
  const payload = await request.text();

  if (
    !verifyStripeSignature(
      payload,
      request.headers.get("stripe-signature"),
      env.webhookSecret,
    )
  ) {
    return NextResponse.json(
      { ok: false, error: "Firma invalida." },
      { status: 400 },
    );
  }

  let event: unknown;

  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON invalido." },
      { status: 400 },
    );
  }

  const change = subscriptionChangeFromEvent(event);

  if (!change) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const admin = createOrchestratorAdminClient();

    const { data: current, error: readError } = await admin
      .from("subscriptions")
      .select("provider_subscription_id, status")
      .eq("organization_id", change.organizationId)
      .maybeSingle();

    if (readError) {
      throw new Error(readError.message);
    }

    // Un evento de una suscripcion antigua (por ejemplo, la cancelacion de
    // una anterior) no debe pisar a la suscripcion vigente.
    const supersedes =
      !current?.provider_subscription_id ||
      current.provider_subscription_id === change.subscriptionId ||
      !["active", "trialing", "past_due"].includes(current.status) ||
      change.plan !== "free";

    if (!supersedes) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const { error: subscriptionError } = await admin
      .from("subscriptions")
      .upsert(
        {
          organization_id: change.organizationId,
          provider: "stripe",
          provider_customer_id: change.customerId,
          provider_subscription_id: change.subscriptionId,
          plan: change.plan,
          status: change.status,
          current_period_end: change.currentPeriodEnd,
        },
        { onConflict: "organization_id" },
      );

    if (subscriptionError) {
      throw new Error(subscriptionError.message);
    }

    const { error: organizationError } = await admin
      .from("organizations")
      .update({ plan: change.plan })
      .eq("id", change.organizationId);

    if (organizationError) {
      throw new Error(organizationError.message);
    }
  } catch (error) {
    console.error("[BILLING][WEBHOOK]", error);

    // 500 hace que Stripe reintente el evento mas tarde.
    return NextResponse.json(
      { ok: false, error: "No se pudo aplicar el evento." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
