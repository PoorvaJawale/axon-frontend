import { clerkMiddleware } from "@clerk/nextjs/server";

// Resource handlers and the dashboard server layout enforce authorization.
export default clerkMiddleware({
  contentSecurityPolicy: {
    strict: true,
    directives: {
      "frame-ancestors": ["'none'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "script-src": ["https://checkout.razorpay.com"],
      "connect-src": ["https://*.razorpay.com"],
      "frame-src": ["https://*.razorpay.com"],
      "img-src": ["https://*.razorpay.com", "data:"],
    },
  },
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
