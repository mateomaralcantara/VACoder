"use server";

import { redirect } from "next/navigation";
import { requireLiveUser } from "@/lib/live1/auth";
import { isPaidPlanId, priceIdForPlan } from "@/lib/billing/plans";
import {
  createCheckoutSession,
  createPortalSession,
  stripeEnv,
} from "@/lib/billing/stripe";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

function billingError(code: string): never {
  redirect("/dashboard/billing?error=" + code);
}

// Solo owner/admin de la organizacion pueden tocar la facturacion. La consulta
// pasa por RLS, asi que un usuario ajeno a la organizacion no obtiene fila.
async function requireBillingAdmin(organizationId: string) {
  const { supabase, user } = await requireLiveUser();

  if (!organizationId) {
    billingError("organizacion");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    billingError("permiso");
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("provider_customer_id, provider_subscription_id, status")
    .eq("organization_id", organizationId)
    .maybeSingle();

  return { user, subscription };
}

export async function startCheckoutAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") || "").trim();
  const plan = String(formData.get("plan") || "").trim();

  const { user, subscription } = await requireBillingAdmin(organizationId);

  if (!stripeEnv().configured) {
    billingError("stripe");
  }

  if (!isPaidPlanId(plan)) {
    billingError("plan");
  }

  const priceId = priceIdForPlan(plan);

  if (!priceId) {
    billingError("precio");
  }

  let url: string | null = null;

  try {
    // Con una suscripcion viva, el cambio de plan se hace en el portal: abrir
    // otro checkout crearia una segunda suscripcion y un cobro doble.
    if (
      subscription?.provider_customer_id &&
      subscription.provider_subscription_id &&
      ACTIVE_STATUSES.has(subscription.status)
    ) {
      url = (await createPortalSession(subscription.provider_customer_id)).url;
    } else {
      const session = await createCheckoutSession({
        organizationId,
        plan,
        priceId,
        customerId: subscription?.provider_customer_id,
        customerEmail: user.email,
      });

      url = session.url;
    }
  } catch (error) {
    console.error("[BILLING][CHECKOUT]", error);
  }

  if (!url) {
    billingError("checkout");
  }

  redirect(url);
}

export async function openBillingPortalAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") || "").trim();

  const { subscription } = await requireBillingAdmin(organizationId);

  if (!stripeEnv().configured) {
    billingError("stripe");
  }

  if (!subscription?.provider_customer_id) {
    billingError("sin-cliente");
  }

  let url: string | null = null;

  try {
    url = (await createPortalSession(subscription.provider_customer_id)).url;
  } catch (error) {
    console.error("[BILLING][PORTAL]", error);
  }

  if (!url) {
    billingError("portal");
  }

  redirect(url);
}
