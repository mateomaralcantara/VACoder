type ResponseLike = Response | Promise<Response>;
type GetHandler = (() => ResponseLike) | ((request: Request) => ResponseLike);
type PostHandler = (request: Request) => ResponseLike;

export type BridgeResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
};

async function parseResponse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const value = await response.json().catch(() => ({}));
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : { value };
  }
  return { text: await response.text().catch(() => "") };
}

export async function dispatchInternalPost(
  handler: PostHandler,
  body: Record<string, unknown>,
): Promise<BridgeResult> {
  const request = new Request("http://vacoder.internal/control-plane", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-vacoder-control-plane": "1" },
    body: JSON.stringify(body),
  });
  const response = await handler(request);
  const data = await parseResponse(response);
  return {
    ok: response.ok && data.ok !== false,
    status: response.status,
    data,
  };
}

export async function dispatchInternalGet(
  handler: GetHandler,
): Promise<BridgeResult> {
  const request = new Request("http://vacoder.internal/control-plane", {
    method: "GET",
    headers: { "x-vacoder-control-plane": "1" },
  });
  const response = handler.length === 0
    ? await (handler as () => ResponseLike)()
    : await (handler as (request: Request) => ResponseLike)(request);
  const data = await parseResponse(response);
  return {
    ok: response.ok && data.ok !== false,
    status: response.status,
    data,
  };
}
