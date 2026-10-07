import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

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

export async function middleware(request: NextRequest) {
  const result = await updateSupabaseSession(request);

  const pathname = request.nextUrl.pathname;

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
  ],
};
