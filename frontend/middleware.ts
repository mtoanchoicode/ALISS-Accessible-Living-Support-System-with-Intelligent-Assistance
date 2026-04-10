import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("aliss_token")?.value;
  const path = request.nextUrl.pathname;

  const isAuthPage = path === "/login" || path === "/register";

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/storage/:path*",
    "/camera/:path*",
    "/chat/:path*",
    "/profile/:path*",
    "/edit/:path*",
    "/live/:path*",
  ],
};

