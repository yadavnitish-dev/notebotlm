"use client";

interface CitationBadgeProps {
  label: string;
  citedText: string;
  onClick: () => void;
}

export function CitationBadge({
  label,
  citedText,
  onClick,
}: CitationBadgeProps) {
  return (
    <span className="citation-badge group relative mx-0.5 inline align-super">
      <button
        type="button"
        aria-label={`View source reference ${label}`}
        className="border-border/80 bg-accent/15 text-accent hover:bg-accent/25 focus-visible:ring-ring inline-flex h-[1.125rem] min-w-[1.125rem] cursor-pointer items-center justify-center rounded-full border px-1 text-[0.65rem] leading-none font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        }}
      >
        {label}
      </button>
      <span
        role="tooltip"
        className="border-border bg-popover text-popover-foreground pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 hidden w-72 max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border p-3 text-left shadow-lg group-hover:block group-focus-within:block"
      >
        <span className="bg-popover text-popover-foreground mb-1 block text-xs font-semibold">
          Source Reference
        </span>
        <span className="text-muted-foreground block text-xs leading-relaxed">
          {citedText}
        </span>
        <span className="border-border bg-popover absolute top-full left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-r border-b" />
      </span>
    </span>
  );
}
