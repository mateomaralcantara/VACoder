import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";
import {
  evaluateLocalToolsAccess,
  isLocalToolsPath,
} from "@/lib/security/local-tools";

function redirectPreservingCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;

  const redirectResponse = NextResponse.redirect(redirectUrl);

  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  return redirectResponse;
}

function jsonPreservingCookies(
  response: NextResponse,
  status: number,
  body: Record<string, unknown>,
) {
  const jsonResponse = NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

  for (const cookie of response.cookies.getAll()) {
    jsonResponse.cookies.set(cookie);
  }

  return jsonResponse;
}

export async function middleware(request: NextRequest) {
  const result = await updateSupabaseSession(request);

  const pathname = request.nextUrl.pathname;

  // /api/project/* y /api/supreme/* tocan el disco y ejecutan procesos en el
  // servidor: nunca se sirven sin pasar por esta politica.
  if (isLocalToolsPath(pathname)) {
    const decision = evaluateLocalToolsAccess({
      isProduction: process.env.NODE_ENV === "production",
      enabledInProduction:
        process.env.VACODER_LOCAL_TOOLS_ENABLED?.trim().toLowerCase() === "true",
      authConfigured: result.configured,
      hasUser: Boolean(result.user),
    });

    if (!decision.allowed) {
      return jsonPreservingCookies(result.response, decision.status, {
        ok: false,
        code: decision.code,
        error: decision.error,
      });
    }

    return result.response;
  }

  const protectedRoute =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/");

  const authRoute =
    pathname === "/login" ||
    pathname === "/signup";

  if (protectedRoute && !result.configured) {
    return redirectPreservingCookies(
      request,
      result.response,
      "/setup",
    );
  }

  if (protectedRoute && !result.user) {
    return redirectPreservingCookies(
      request,
      result.response,
      "/login",
    );
  }

  if (authRoute && result.user) {
    return redirectPreservingCookies(
      request,
      result.response,
      "/dashboard",
    );
  }

  return result.response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/signup",
    "/api/project/:path*",
    "/api/supreme/:path*",
  ],
};
