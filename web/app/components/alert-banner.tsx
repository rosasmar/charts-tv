import type { PriceAlert } from "@/app/lib/alerts";

// Full-width banner across the top of the screen for a price alert, big
// enough to catch from across the room. Green for up, red for down, neutral
// for confirmations ("Alert set").
export function AlertBanner({ alert }: { alert: PriceAlert | undefined }) {
  if (!alert) return null;
  const up = alert.direction === "up";
  const info = alert.direction === "info";

  return (
    <div
      key={alert.id}
      role="alert"
      className={`alert-enter fixed inset-x-[3rem] top-[2rem] z-50 flex items-center gap-[2rem] rounded-[1.75rem] border-2 px-[3rem] py-[1.75rem] ${
        info
          ? "border-highlight/40 bg-alert-info shadow-[0_0_4rem_-1rem_var(--alert-info-glow)]"
          : up
            ? "border-up bg-alert-up shadow-[0_0_4rem_-1rem_var(--up)]"
            : "border-down bg-alert-down shadow-[0_0_4rem_-1rem_var(--down)]"
      }`}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`h-[4rem] w-[4rem] shrink-0 ${info ? "text-foreground" : up ? "text-up" : "text-down"}`}
      >
        <path
          d={
            info
              ? "M12 2a7 7 0 0 1 7 7v3.586l1.707 1.707A1 1 0 0 1 20 16H4a1 1 0 0 1-.707-1.707L5 12.586V9a7 7 0 0 1 7-7zm0 18a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2z"
              : up
                ? "M12 4l9 14H3z"
                : "M12 20L3 6h18z"
          }
        />
      </svg>
      <div className="min-w-0">
        <div className="text-[1.5rem] font-medium uppercase tracking-[0.2em] text-muted">
          {info ? "Alert set" : "Price alert"}
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
