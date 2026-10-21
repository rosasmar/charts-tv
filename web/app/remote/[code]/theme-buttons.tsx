"use client";

const THEMES = [
  { label: "Dark", command: "dark mode" },
  { label: "Light", command: "light mode" },
  { label: "Auto", command: "auto mode" },
  { label: "Neon", command: "neon mode" },
];

/**
 * "Display" section of the phone remote: picks the TV's theme by sending the
 * same text commands a viewer could type. Auto is light by day and dark from
 * 22:00 to 07:00; neon is just for fun. The TV remembers the choice across
 * reloads.
 */
// TODO: Highlight the TV's current theme here once the TV can report its
// state back to the phone (commands only flow phone → TV today).
export function ThemeButtons({ onSend }: { onSend: (cmd: string) => void }) {
  return (
    <div style={styles.section}>
      <div style={styles.label}>Display</div>
      <div style={styles.row}>
        {THEMES.map(({ label, command }) => (
          <button key={label} style={styles.btn} onClick={() => onSend(command)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Same look as the quick buttons in remote-ui.tsx.
const styles: Record<string, React.CSSProperties> = {
  section: {
    marginBottom: "1.5rem",
  },
  label: {
    fontSize: "0.85rem",
    color: "#8a8a8a",
    marginBottom: "0.5rem",
  },
  row: {
    display: "flex",
    gap: "0.5rem",
  },
  btn: {
    flex: 1,
    background: "#1a1a1a",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "0.75rem",
    color: "#f5f5f5",
    cursor: "pointer",
    fontSize: "1rem",
    padding: "0.75rem 1rem",
    touchAction: "manipulation",
  },
};
