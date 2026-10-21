"use client";

import { useCallback, useRef, useState } from "react";
import { parseCommand } from "@/app/lib/remote-commands";
import { isValidCode } from "@/app/lib/pairing-code";
import { BackgroundSection } from "./background-section";

type Status = "idle" | "sending" | "sent" | "error" | "not_understood" | "unreachable";

// SpeechRecognition is not in the standard TS lib; define a minimal shape.
type AnyWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
};

/**
 * R14 — mobile phone remote UI. Receives the pairing code as a plain prop
 * from the server page so this file has no async/params concerns.
 */
export function RemoteUI({ code }: { code: string }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [paused, setPaused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validCode = isValidCode(code);

  const sendText = useCallback(
    async (value: string) => {
      if (!value.trim() || !validCode) return;
      // R5 – parse on phone before sending.
      const parsed = parseCommand(value);
      if (!parsed) {
        setStatus("not_understood");
        setTimeout(() => setStatus("idle"), 3000);
        return;
      }
      setStatus("sending");
      try {
        const res = await fetch(`/api/remote/${code}/commands`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value }),
        });
        if (res.status === 201) {
          setStatus("sent");
          setText("");
        } else if (res.status === 422) {
          setStatus("not_understood");
        } else if (res.status === 503) {
          setStatus("unreachable");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("unreachable");
      }
      setTimeout(() => setStatus("idle"), 3000);
    },
    [code, validCode],
  );

  const sendQuick = useCallback(
    async (cmd: string) => {
      setText(cmd);
      await sendText(cmd);
    },
    [sendText],
  );

  // Mic button using Web Speech API (R14).
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [speechSupported] = useState(
    () => {
      if (typeof window === "undefined") return false;
      const w = window as AnyWindow;
      return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
    },
  );

  const startListening = useCallback(() => {
    const w = window as AnyWindow;
    const SpeechRecognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setText(transcript);
      sendText(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [sendText]);

  const statusMessage: Record<Status, string> = {
    idle: "",
    sending: "Sending…",
    sent: "Sent ✓",
    not_understood: "Didn't catch that. Try 'show bitcoin' or 'pause'.",
    error: "Something went wrong. Try again.",
    unreachable: "TV not reachable — check the code.",
  };

  if (!validCode) {
    return (
      <div style={styles.page}>
        <div style={styles.error}>Invalid remote code.</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>ChartsTV Remote</h1>
      <div style={styles.codeLabel}>
        Code: <span style={styles.code}>{code}</span>
      </div>

      {/* Text input + send (R14) */}
      <div style={styles.inputRow}>
        <input
          ref={inputRef}
          style={styles.input}
          type="text"
          placeholder="e.g. show bitcoin"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendText(text)}
          aria-label="Command"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button
          style={{ ...styles.btn, ...styles.sendBtn }}
          onClick={() => sendText(text)}
          disabled={status === "sending"}
          aria-label="Send command"
        >
          Send
        </button>
        {/* Mic button — hidden when unsupported (R14) */}
        {speechSupported && (
          <button
            style={{
              ...styles.btn,
              ...(listening ? styles.micActive : styles.micBtn),
            }}
            onClick={startListening}
            disabled={listening}
            aria-label="Speak command"
          >
            {listening ? "🎙…" : "🎙"}
          </button>
        )}
      </div>

      {/* Status line */}
      <div
        style={{
          ...styles.statusLine,
          color:
            status === "sent"
              ? "#22c55e"
              : status === "not_understood" ||
                  status === "unreachable" ||
                  status === "error"
                ? "#ef4444"
                : "#8a8a8a",
        }}
        role="status"
        aria-live="polite"
      >
        {statusMessage[status]}
      </div>

      {/* Quick buttons (R14) */}
      <div style={styles.quickRow}>
        <button style={styles.btn} onClick={() => sendQuick("previous")}>
          ◀◀ Prev
        </button>
        <button
          style={styles.btn}
          onClick={() => {
            const cmd = paused ? "play" : "pause";
            setPaused(!paused);
            sendQuick(cmd);
          }}
        >
          {paused ? "▶ Play" : "⏸ Pause"}
        </button>
        <button style={styles.btn} onClick={() => sendQuick("next")}>
          ▶▶ Next
        </button>
      </div>

      <BackgroundSection code={code} />

      {/* Example commands (R14) */}
      <div style={styles.examples}>
        <div style={styles.examplesLabel}>Try:</div>
        {["show bitcoin", "pause", "alert me if amazon drops 3%"].map((ex) => (
          <button
            key={ex}
            style={styles.exampleBtn}
            onClick={() => {
              setText(ex);
              sendText(ex);
            }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

// Mobile-first inline styles — matches the TV's dark palette (R14).
const styles: Record<string, React.CSSProperties> = {
  page: {
    background: "#000",
    color: "#f5f5f5",
    minHeight: "100dvh",
    padding: "2rem 1.25rem",
    fontFamily: "system-ui, sans-serif",
    maxWidth: 480,
    margin: "0 auto",
    boxSizing: "border-box",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    margin: "0 0 0.5rem",
  },
  codeLabel: {
    fontSize: "0.9rem",
    color: "#8a8a8a",
    marginBottom: "1.5rem",
  },
  code: {
    fontFamily: "monospace",
    letterSpacing: "0.15em",
    color: "#f5f5f5",
  },
  inputRow: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "0.75rem",
  },
  input: {
    flex: 1,
    background: "#111",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "0.75rem",
    color: "#f5f5f5",
    fontSize: "1rem",
    padding: "0.75rem 1rem",
    outline: "none",
    minWidth: 0,
  },
  btn: {
    background: "#1a1a1a",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "0.75rem",
    color: "#f5f5f5",
    cursor: "pointer",
    fontSize: "1rem",
    padding: "0.75rem 1rem",
    flexShrink: 0,
    touchAction: "manipulation",
  },
  sendBtn: {
    background: "#ffffff",
    color: "#000",
    fontWeight: 600,
  },
  micBtn: {},
  micActive: {
    background: "#ef4444",
    borderColor: "#ef4444",
  },
  statusLine: {
    fontSize: "0.9rem",
    minHeight: "1.5rem",
    marginBottom: "1.25rem",
  },
  quickRow: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "1.5rem",
  },
  examples: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    marginTop: "0.5rem",
  },
  examplesLabel: {
    fontSize: "0.85rem",
    color: "#8a8a8a",
    marginBottom: "0.25rem",
  },
  exampleBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "0.75rem",
    color: "#a0a0a0",
    cursor: "pointer",
    fontSize: "0.9rem",
    padding: "0.6rem 1rem",
    textAlign: "left",
    touchAction: "manipulation",
  },
  error: {
    color: "#ef4444",
  },
};
