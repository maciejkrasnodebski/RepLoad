import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "token"; // nazwa cookie ustawianego przez backend

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isPublic =
    isAuthPage || pathname === "/regulamin" || pathname === "/cookies";

  // Brak cookie na stronie prywatnej (np. "/") -> teleport na /login
  if (!hasCookie && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/((?!api|_next|.*\\..*).*)"],
};
