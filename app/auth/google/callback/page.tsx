"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Google OAuth callback page — opened in a popup.
 * Receives the auth code from Google, exchanges it for tokens via our API,
 * then passes the result back to the opener window and closes.
 */
export default function GoogleCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorParam = params.get("error");

      if (errorParam) {
        setStatus("error");
        setError(errorParam === "access_denied" ? "Access denied — you cancelled the sign-in." : errorParam);
        return;
      }

      if (!code) {
        setStatus("error");
        setError("No authorization code received from Google.");
        return;
      }

      try {
        const res = await fetch("/api/google/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirectUri: `${window.location.origin}/auth/google/callback`,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Token exchange failed");
        }

        // Send tokens back to the opener window
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "GOOGLE_OAUTH_SUCCESS",
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiresIn: data.expires_in,
              scope: data.scope,
            },
            window.location.origin
          );
          setStatus("success");
          // Close popup after a brief flash of success
          setTimeout(() => window.close(), 1200);
        } else {
          setStatus("error");
          setError("Could not communicate with the main window. Please close this tab and try again.");
        }
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Authentication failed");
      }
    }

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-sm w-full text-center shadow-lg">
        {status === "loading" && (
          <>
            <Loader2 className="w-10 h-10 text-[#2CACE8] animate-spin mx-auto mb-4" />
            <h2 className="text-[16px] font-semibold">Signing in with Google...</h2>
            <p className="text-[13px] text-gray-500 mt-1">Exchanging authorization code</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="w-10 h-10 text-[#08AE67] mx-auto mb-4" />
            <h2 className="text-[16px] font-semibold text-[#08AE67]">Connected!</h2>
            <p className="text-[13px] text-gray-500 mt-1">This window will close automatically...</p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h2 className="text-[16px] font-semibold text-red-600">Connection Failed</h2>
            <p className="text-[13px] text-red-500 mt-1">{error}</p>
            <button
              onClick={() => window.close()}
              className="mt-4 px-4 py-2 bg-gray-100 rounded-lg text-[13px] font-medium hover:bg-gray-200 transition-colors"
            >
              Close Window
            </button>
          </>
        )}
      </div>
    </div>
  );
}
