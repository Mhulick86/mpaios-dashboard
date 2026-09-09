import type { NextRequest } from "next/server";

export const STATE_COOKIE = "maios_oauth_nonce";

/** Public origin of this deployment, honouring reverse-proxy headers (Vercel). */
export function publicOrigin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${forwardedHost}`;
  }
  if (configured && !new URL(req.url).hostname.includes("localhost")) return configured.replace(/\/+$/, "");
  return new URL(req.url).origin;
}
