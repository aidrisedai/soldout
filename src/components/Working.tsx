"use client";

import { useEffect, useState } from "react";

// Shown wherever SoldOut is busy: a live indicator, a shimmer bar, and a rotating
// plain-English line explaining what it's doing right now.
export default function Working({ steps, title, compact = false, interval = 2600 }: { steps: string[]; title?: string; compact?: boolean; interval?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), interval);
    return () => clearInterval(t);
  }, [steps.length, interval]);
  return (
    <div className={compact ? "py-1" : "py-6"}>
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3 flex-none">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-clay/60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-clay" />
        </span>
        <div className="min-w-0">
          {title && <p className={`font-semibold ${compact ? "text-sm" : ""}`}>{title}</p>}
          <p key={i} className={`animate-[fadein_.4s_ease] text-muted ${compact ? "text-xs" : "text-sm"}`}>{steps[i]}</p>
        </div>
      </div>
      <div className={`relative mt-3 overflow-hidden rounded-full bg-sand ${compact ? "h-1" : "h-1.5"}`}>
        <div className="absolute inset-y-0 w-1/3 animate-[shimmer_1.6s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-clay to-transparent" />
      </div>
      {!compact && steps.length > 1 && (
        <ol className="mt-4 space-y-1.5 text-sm">
          {steps.map((s, k) => (
            <li key={s} className={`flex items-center gap-2 transition ${k < i ? "text-forest" : k === i ? "text-ink" : "text-muted/60"}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${k < i ? "bg-forest text-white" : k === i ? "border-2 border-clay" : "border border-line"}`}>{k < i ? "✓" : ""}</span>
              {s}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function Typing() {
  return (
    <span className="inline-flex items-center gap-1 rounded-2xl bg-mint px-3 py-2.5">
      {[0, 1, 2].map((d) => (
        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-forest/70" style={{ animationDelay: `${d * 0.15}s` }} />
      ))}
    </span>
  );
}
