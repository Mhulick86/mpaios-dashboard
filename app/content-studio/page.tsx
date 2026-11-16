"use client";

/**
 * Content Studio inside MAIOS. The studio UI is served as static files from /studio/ (see scripts/sync-studio.mjs)
 * and talks to the Content Studio backend running next to LM Studio (default http://127.0.0.1:4173).
 */
export default function ContentStudioPage() {
  return (
    <div className="flex flex-col w-full h-[calc(100dvh-6rem)] md:h-[calc(100dvh-4rem)] rounded-xl overflow-hidden border border-white/10">
      <iframe
        src="/studio/index.html"
        title="MAIOS Content Studio"
        className="flex-1 w-full border-0 bg-[#0b0e15]"
      />
    </div>
  );
}
