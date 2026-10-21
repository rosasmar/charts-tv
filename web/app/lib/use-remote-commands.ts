"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RemoteCommand } from "@/app/lib/remote-commands";

/**
 * R11 — polls GET /api/remote/[code]/commands?after=<id> and fires
 * onCommand for each new command in order.
 *
 * Adaptive polling: 5 s idle, 1 s for 2 min after last command.
 * Does not poll while document is hidden.
 */
const IDLE_INTERVAL = 5_000;
const ACTIVE_INTERVAL = 1_000;
const ACTIVE_WINDOW = 120_000; // 2 minutes

type StoredEntry = { id: number; command: RemoteCommand };

export function useRemoteCommands(
  code: string | null,
  onCommand: (cmd: RemoteCommand) => void,
) {
  const lastId = useRef<number>(0);
  const activeUntil = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onCommandRef = useRef(onCommand);

  // Keep ref up-to-date without restarting the loop.
  useEffect(() => {
    onCommandRef.current = onCommand;
  });

  const poll = useCallback(async () => {
    if (!code) return;
    if (document.visibilityState === "hidden") return;

    try {
      const res = await fetch(
        `/api/remote/${code}/commands?after=${lastId.current}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as { commands: StoredEntry[] };
        if (data.commands.length > 0) {
          activeUntil.current = Date.now() + ACTIVE_WINDOW;
          for (const entry of data.commands) {
            if (entry.id > lastId.current) {
              lastId.current = entry.id;
              onCommandRef.current(entry.command);
            }
          }
        }
      }
    } catch {
      // Network errors are ignored — retry on next tick (R11).
    }
  }, [code]);

  useEffect(() => {
    if (!code) return;

    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const interval =
        Date.now() < activeUntil.current ? ACTIVE_INTERVAL : IDLE_INTERVAL;
      timerRef.current = setTimeout(async () => {
        await poll();
        schedule();
      }, interval);
    };

    schedule();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timerRef.current);
        schedule();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [code, poll]);
}
