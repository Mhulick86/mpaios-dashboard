"use client";

import { useState } from "react";
import { submitFeedback } from "@/lib/evaluation";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface FeedbackButtonProps {
  messageId: string;
  conversationId?: string;
}

export function FeedbackButton({ messageId, conversationId }: FeedbackButtonProps) {
  const [submitted, setSubmitted] = useState<"up" | "down" | null>(null);

  const handleFeedback = async (thumbs: "up" | "down") => {
    if (submitted) return;
    setSubmitted(thumbs);
    await submitFeedback({
      messageId,
      conversationId,
      thumbs,
    });
  };

  return (
    <div className="flex items-center gap-1 mt-1">
      <button
        onClick={() => handleFeedback("up")}
        disabled={!!submitted}
        className={`p-1 rounded transition-colors ${
          submitted === "up"
            ? "text-brand-green bg-brand-green/10"
            : submitted
              ? "text-text-muted opacity-40 cursor-not-allowed"
              : "text-text-muted hover:text-brand-green hover:bg-brand-green/10"
        }`}
        title="Good response"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleFeedback("down")}
        disabled={!!submitted}
        className={`p-1 rounded transition-colors ${
          submitted === "down"
            ? "text-div-5 bg-red-500/10"
            : submitted
              ? "text-text-muted opacity-40 cursor-not-allowed"
              : "text-text-muted hover:text-div-5 hover:bg-red-500/10"
        }`}
        title="Bad response"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
