import { NextResponse, type NextRequest } from "next/server";

// Everything except the landing page and inbound webhooks sits behind a password,
// because the dashboard shows parents' phone numbers and conversations.
// Set DASHBOARD_PASSWORD on the server; user name can be anything.
export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next(); // local dev without a password
  const auth = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    const [, pass] = atob(encoded).split(":");
    if (pass === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="SoldOut"' } });
}

export const config = {
  matcher: ["/dashboard/:path*", "/intake/:path*", "/simulate/:path*", "/api/((?!whatsapp/webhook|stripe/webhook|health).*)"],
};
