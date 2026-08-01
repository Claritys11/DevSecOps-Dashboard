import { auth } from "@/auth";

export default auth((request) => {
  const isLoggedIn = Boolean(request.auth);
  const isLogin = request.nextUrl.pathname === "/login";
  const isPublicApi = request.nextUrl.pathname.startsWith("/api/health") || request.nextUrl.pathname.startsWith("/api/agents");

  if (!isLoggedIn && !isLogin && !isPublicApi) {
    return Response.redirect(new URL("/login", request.nextUrl));
  }

  if (isLoggedIn && isLogin) {
    return Response.redirect(new URL("/", request.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
