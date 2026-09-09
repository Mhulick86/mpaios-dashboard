"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Meta (Facebook) OAuth callback page — opened in a popup.
 * Receives the auth code from Meta, exchanges it for a long-lived token via
 * our API, then posts the result back to the opener and closes.
 */
export default function MetaCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorParam = params.get("error");
      const errorReason = params.get("error_reason");
      const errorDescription = params.get("error_description");

      function reportError(message: string) {
        setStatus("error");
        setError(message);
        if (window.opener) {
          window.opener.postMessage(
            { type: "META_OAUTH_ERROR", error: message },
            window.location.origin
          );
        }
      }

      if (errorParam) {
        reportError(
          errorReason === "user_denied"
            ? "Access denied — you cancelled the Meta sign-in."
            : errorDescription || errorParam
        );
        return;
      }

      if (!code) {
        reportError("No authorization code received from Meta.");
        return;
      }

      try {
        const res = await fetch("/api/meta-ads/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirectUri: `${window.location.origin}/auth/meta/callback`,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Token exchange failed");

        if (window.opener) {
          window.opener.postMessage(
            {
              type: "META_OAUTH_SUCCESS",
              accessToken: data.access_token,
              expiresIn: data.expires_in,
              longLived: data.long_lived,
            },
            window.location.origin
          );
          setStatus("success");
          setTimeout(() => window.close(), 1000);
        } else {
          setStatus("error");
          setError("Could not communicate with the main window.");
        }
      } catch (err) {
        reportError(err instanceof Error ? err.message : "Authentication failed");
      }
    }

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-sm w-full text-center shadow-lg">
        {status === "loading" && (
          <>
            <Loader2 className="w-10 h-10 text-[#1877F2] animate-spin mx-auto mb-4" />
            <h2 className="text-[16px] font-semibold">Connecting to Meta...</h2>
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
