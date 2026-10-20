import type { PriceAlert } from "@/app/lib/alerts";

// Full-width banner across the top of the screen for a price alert, big
// enough to catch from across the room. Green for up, red for down.
export function AlertBanner({ alert }: { alert: PriceAlert | undefined }) {
  if (!alert) return null;
  const up = alert.direction === "up";

  return (
    <div
      key={alert.id}
      role="alert"
      className={`alert-enter fixed inset-x-[3rem] top-[2rem] z-50 flex items-center gap-[2rem] rounded-[1.75rem] border-2 px-[3rem] py-[1.75rem] ${
        up
          ? "border-up bg-[#06210f] shadow-[0_0_4rem_-1rem_var(--up)]"
          : "border-down bg-[#2a0808] shadow-[0_0_4rem_-1rem_var(--down)]"
      }`}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`h-[4rem] w-[4rem] shrink-0 ${up ? "text-up" : "text-down"}`}
      >
        <path d={up ? "M12 4l9 14H3z" : "M12 20L3 6h18z"} />
      </svg>
      <div className="min-w-0">
        <div className="text-[1.5rem] font-medium uppercase tracking-[0.2em] text-muted">
          Price alert
        </div>
        <div className="text-[3.5rem] font-semibold leading-tight tracking-tight">
          {alert.title}
        </div>
      </div>
      <div className="ml-auto font-mono text-[2.25rem] tabular-nums text-foreground/90">
        {alert.detail}
      </div>
    </div>
  );
}
