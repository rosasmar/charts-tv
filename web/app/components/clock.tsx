"use client";

import { useEffect, useState } from "react";

// Large, thin clock and date for the top-left of the screen. The time is only
// rendered after mount: under Cache Components, reading the current time while
// prerendering is not allowed, and it would mismatch on hydration anyway.
export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const date = new Date();
      setNow(date);
      // Re-align to the start of the next second so the clock never drifts.
      timer = setTimeout(tick, 1000 - date.getMilliseconds());
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="leading-none">
      <div className="text-[7rem] font-extralight tracking-tight tabular-nums">
        {now
          ? now.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : " "}
      </div>
      <div className="mt-3 text-[2rem] font-light text-muted">
        {now
          ? now.toLocaleDateString([], {
              weekday: "long",
              month: "long",
              day: "numeric",
            })
          : " "}
      </div>
    </div>
  );
}
