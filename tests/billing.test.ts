import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  canCreateProject,
  getPlan,
  planForPriceId,
  priceIdForPlan,
} from "../lib/billing/plans.ts";
import {
  subscriptionChangeFromEvent,
  verifyStripeSignature,
} from "../lib/billing/stripe-events.ts";

const SECRET = "whsec_test_secret";
const NOW = 1_800_000_000;
const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENV = {
  STRIPE_PRICE_PRO: "price_pro",
  STRIPE_PRICE_BUSINESS: "price_business",
  STRIPE_PRICE_AGENCY: "price_agency",
};

function sign(payload: string, timestamp = NOW, secret = SECRET) {
  const v1 = createHmac("sha256", secret).update(timestamp + "." + payload).digest("hex");
  return "t=" + timestamp + ",v1=" + v1;
}

test("firma valida", () => {
  const payload = '{"id":"evt_1"}';
  assert.equal(verifyStripeSignature(payload, sign(payload), SECRET, { nowSeconds: NOW }), true);
});

test("firma: acepta una de varias v1 (rotacion de secreto)", () => {
  const payload = "{}";
  const header = sign(payload) + ",v1=" + "0".repeat(64);
  assert.equal(verifyStripeSignature(payload, header, SECRET, { nowSeconds: NOW }), true);
});

test("firma: cuerpo alterado", () => {
  const header = sign('{"plan":"free"}');
  assert.equal(
    verifyStripeSignature('{"plan":"agency"}', header, SECRET, { nowSeconds: NOW }),
    false,
  );
});

test("firma: secreto incorrecto", () => {
  const payload = "{}";
  assert.equal(
    verifyStripeSignature(payload, sign(payload, NOW, "otro"), SECRET, { nowSeconds: NOW }),
    false,
  );
});

test("firma: evento viejo reenviado (replay)", () => {
  const payload = "{}";
  assert.equal(
    verifyStripeSignature(payload, sign(payload, NOW - 3600), SECRET, { nowSeconds: NOW }),
    false,
  );
});

test("firma: cabeceras malformadas o ausentes", () => {
  for (const header of [null, undefined, "", "t=abc,v1=zz", "v1=" + "a".repeat(64), "t=" + NOW, "t=" + NOW + ",v1=abc"]) {
    assert.equal(verifyStripeSignature("{}", header, SECRET, { nowSeconds: NOW }), false);
  }
  assert.equal(verifyStripeSignature("{}", sign("{}"), "", { nowSeconds: NOW }), false);
});

function subscriptionEvent(type: string, overrides: Record<string, unknown> = {}) {
  return {
    type,
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        current_period_end: NOW,
        metadata: { organization_id: ORG },
        items: { data: [{ price: { id: "price_pro" } }] },
        ...overrides,
      },
    },
  };
}

test("evento: suscripcion activa asigna el plan del precio", () => {
  assert.deepEqual(subscriptionChangeFromEvent(subscriptionEvent("customer.subscription.created"), ENV), {
    organizationId: ORG,
    plan: "pro",
    status: "active",
    customerId: "cus_1",
    subscriptionId: "sub_1",
    currentPeriodEnd: new Date(NOW * 1000).toISOString(),
  });
});

test("evento: cambio de precio cambia el plan", () => {
  const change = subscriptionChangeFromEvent(
    subscriptionEvent("customer.subscription.updated", {
      items: { data: [{ price: "price_agency", current_period_end: NOW }] },
      current_period_end: undefined,
    }),
    ENV,
  );
  assert.equal(change?.plan, "agency");
  assert.equal(change?.currentPeriodEnd, new Date(NOW * 1000).toISOString());
});

test("evento: past_due conserva el plan, unpaid/canceled vuelven a free", () => {
  const plan = (status: string) =>
    subscriptionChangeFromEvent(subscriptionEvent("customer.subscription.updated", { status }), ENV)?.plan;
  assert.equal(plan("trialing"), "pro");
  assert.equal(plan("past_due"), "pro");
  assert.equal(plan("unpaid"), "free");
  assert.equal(plan("canceled"), "free");
  assert.equal(plan("incomplete"), "free");
});

test("evento: suscripcion eliminada vuelve a free", () => {
  const change = subscriptionChangeFromEvent(subscriptionEvent("customer.subscription.deleted"), ENV);
  assert.equal(change?.plan, "free");
  assert.equal(change?.status, "canceled");
});

test("evento: precio desconocido no regala un plan", () => {
  const change = subscriptionChangeFromEvent(
    subscriptionEvent("customer.subscription.updated", { items: { data: [{ price: { id: "price_otro" } }] } }),
    ENV,
  );
  assert.equal(change?.plan, "free");
});

test("evento: sin organizacion valida se ignora", () => {
  assert.equal(subscriptionChangeFromEvent(subscriptionEvent("customer.subscription.updated", { metadata: {} }), ENV), null);
  assert.equal(
    subscriptionChangeFromEvent(subscriptionEvent("customer.subscription.updated", { metadata: { organization_id: "1 or 1=1" } }), ENV),
    null,
  );
});

test("evento: otros tipos y basura se ignoran", () => {
  assert.equal(subscriptionChangeFromEvent({ type: "invoice.paid", data: { object: {} } }, ENV), null);
  assert.equal(subscriptionChangeFromEvent({ type: "checkout.session.completed", data: { object: { metadata: { plan: "agency", organization_id: ORG } } } }, ENV), null);
  assert.equal(subscriptionChangeFromEvent(null, ENV), null);
  assert.equal(subscriptionChangeFromEvent("texto", ENV), null);
});

test("planes: precios y limites", () => {
  assert.equal(priceIdForPlan("pro", ENV), "price_pro");
  assert.equal(priceIdForPlan("pro", {}), null);
  assert.equal(planForPriceId("price_business", ENV), "business");
  assert.equal(planForPriceId("", ENV), null);
  assert.equal(planForPriceId(undefined, {}), null);
  assert.equal(getPlan("no-existe").id, "free");
  assert.equal(getPlan("constructor").id, "free");
  assert.equal(canCreateProject("free", 1), true);
  assert.equal(canCreateProject("free", 2), false);
  assert.equal(canCreateProject("pro", 9), true);
  assert.equal(canCreateProject("pro", 10), false);
  assert.equal(canCreateProject("enterprise", 100000), true);
});
