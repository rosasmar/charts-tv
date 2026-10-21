"use client";

import { useLayoutEffect } from "react";
import { THEME_SCRIPT, resolveTheme } from "@/app/lib/theme";
import { useThemeSetting } from "@/app/lib/use-theme";

// Dark (the default), light or auto, picked from the phone. The theme is a
// data-theme attribute on <html> that swaps the color tokens in globals.css.
// The inline script sets it while the page is still loading, so a saved light
// theme never flashes dark first; after that the effect keeps it in step with
// phone commands, and re-checks auto every minute (light by day, dark from
// 22:00 to 07:00, like night dim).
export function Theme() {
  const setting = useThemeSetting();

  useLayoutEffect(() => {
    if (!setting) return; // Hydrating: keep what the inline script set.
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(setting, new Date());
    };
    apply();
    if (setting !== "auto") return;
    const timer = setInterval(apply, 60_000);
    return () => clearInterval(timer);
  }, [setting]);

  return (
    <script
      // Only the server-rendered copy should run. React warns about <script>
      // rendered on the client, so it gets an inert type there instead.
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
