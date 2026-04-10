import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  const path = request.nextUrl.pathname;
  const isAuthPage = path === "/login" || path === "/register";

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectRes = NextResponse.redirect(url);
    // Persist any cookies set by Supabase
    supabaseResponse.cookies.getAll().forEach(cookie => {
        redirectRes.cookies.set(cookie.name, cookie.value, { ...cookie, options: undefined } as any);
    });
    return redirectRes;
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const redirectRes = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(cookie => {
        redirectRes.cookies.set(cookie.name, cookie.value, { ...cookie, options: undefined } as any);
    });
    return redirectRes;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/storage",
    "/camera",
    "/chat",
    "/profile",
    "/live",
  ],
};
