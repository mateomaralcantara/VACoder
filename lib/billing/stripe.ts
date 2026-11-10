// Cliente minimo de la API REST de Stripe (sin SDK).

type Params = Record<string, string | number | boolean | undefined>;

export function stripeEnv() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";

  return {
    secretKey,
    webhookSecret,
    configured: Boolean(secretKey),
  };
}

export function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
    "http://localhost:3000"
  );
}

async function stripePost<T>(path: string, params: Params, idempotencyKey?: string): Promise<T> {
  const env = stripeEnv();

  if (!env.configured) {
    throw new Error("Falta STRIPE_SECRET_KEY: la facturacion no esta configurada.");
  }

  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      body.set(key, String(value));
    }
  }

  const response = await fetch("https://api.stripe.com/v1" + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.secretKey,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body,
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(
      "Stripe rechazo la solicitud: " +
        (data.error?.message || "HTTP " + response.status),
    );
  }

  return data as T;
}

export async function createCheckoutSession(input: {
  organizationId: string;
  plan: string;
  priceId: string;
  customerId?: string | null;
  customerEmail?: string | null;
}) {
  const base = siteUrl() + "/dashboard/billing";

  return stripePost<{ id: string; url: string | null }>("/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": 1,
    success_url: base + "?checkout=success",
    cancel_url: base + "?checkout=cancelled",
    client_reference_id: input.organizationId,
    customer: input.customerId || undefined,
    customer_email: input.customerId ? undefined : input.customerEmail || undefined,
    // El webhook identifica la organizacion por esta metadata.
    "subscription_data[metadata][organization_id]": input.organizationId,
    "metadata[organization_id]": input.organizationId,
    "metadata[plan]": input.plan,
    allow_promotion_codes: true,
  });
}

export async function createPortalSession(customerId: string) {
  return stripePost<{ url: string }>("/billing_portal/sessions", {
    customer: customerId,
    return_url: siteUrl() + "/dashboard/billing",
  });
}
