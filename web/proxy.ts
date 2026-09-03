import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed the middleware convention to `proxy`; next-intl's
// middleware factory is request/response shaped, so it works as-is.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, and files with an extension
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
