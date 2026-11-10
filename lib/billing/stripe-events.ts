// Verificacion de firma y traduccion de eventos de Stripe.
// Sin dependencias de red ni de Next: todo aqui es comprobable con pruebas.

import { createHmac, timingSafeEqual } from "node:crypto";
import { planForPriceId, type PlanId } from "./plans.ts";

type Env = Record<string, string | undefined>;

export function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secret: string,
  options: { toleranceSeconds?: number; nowSeconds?: number } = {},
) {
  if (!header || !secret) {
    return false;
  }

  const tolerance = options.toleranceSeconds ?? 300;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  let timestamp = "";
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const index = part.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }

  if (!/^\d+$/.test(timestamp) || signatures.length === 0) {
    return false;
  }

  if (Math.abs(now - Number(timestamp)) > tolerance) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(timestamp + "." + payload, "utf8")
    .digest();

  return signatures.some((signature) => {
    if (!/^[0-9a-f]{64}$/i.test(signature)) {
      return false;
    }

    return timingSafeEqual(expected, Buffer.from(signature, "hex"));
  });
}

export type SubscriptionChange = {
  organizationId: string;
  plan: PlanId;
  status: string;
  customerId: string | null;
  subscriptionId: string | null;
  currentPeriodEnd: string | null;
};

type Json = Record<string, unknown>;

function asObject(value: unknown): Json {
  return value && typeof value === "object" ? (value as Json) : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

// Stripe devuelve un id o el objeto expandido segun la llamada.
function idOf(value: unknown) {
  return asString(value) ?? asString(asObject(value).id);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Estados en los que el cliente conserva el plan pagado. `past_due` lo
// conserva mientras Stripe reintenta el cobro.
const ENTITLED = new Set(["active", "trialing", "past_due"]);

// Devuelve el cambio a aplicar, o null si el evento no afecta al plan.
// Solo se usan eventos de suscripcion: son los que traen el precio y el
// estado reales, asi que el plan nunca se deduce de datos del navegador.
export function subscriptionChangeFromEvent(
  event: unknown,
  env: Env = process.env,
): SubscriptionChange | null {
  const root = asObject(event);
  const type = asString(root.type);

  if (
    type !== "customer.subscription.created" &&
    type !== "customer.subscription.updated" &&
    type !== "customer.subscription.deleted"
  ) {
    return null;
  }

  const subscription = asObject(asObject(root.data).object);
  const organizationId = asString(asObject(subscription.metadata).organization_id);

  if (!organizationId || !UUID.test(organizationId)) {
    return null;
  }

  const items = asObject(subscription.items).data;
  const firstItem = asObject(Array.isArray(items) ? items[0] : null);
  const paidPlan = planForPriceId(idOf(firstItem.price), env);

  const status =
    type === "customer.subscription.deleted"
      ? "canceled"
      : asString(subscription.status) ?? "incomplete";

  // Las versiones recientes de la API mueven el fin de periodo al item.
  const periodEnd =
    typeof subscription.current_period_end === "number"
      ? subscription.current_period_end
      : typeof firstItem.current_period_end === "number"
        ? firstItem.current_period_end
        : null;

  return {
    organizationId,
    plan: ENTITLED.has(status) && paidPlan ? paidPlan : "free",
    status,
    customerId: idOf(subscription.customer),
    subscriptionId: asString(subscription.id),
    currentPeriodEnd:
      periodEnd === null ? null : new Date(periodEnd * 1000).toISOString(),
  };
}
