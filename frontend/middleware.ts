import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('aliss_token')?.value;
  const path = request.nextUrl.pathname;

  const isAuthPage = path === '/' || path === '/register';

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/register', '/home', '/storage', '/camera', '/chat', '/profile', '/live']
};
