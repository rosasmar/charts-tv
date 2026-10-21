// Switches the TV's chart between 1-minute and 30-minute candles. The buttons
// send the same text commands a viewer could type, through the remote's usual
// POST path. The TV remembers the choice, so it survives a reload.
export function CandleButtons({ onSend }: { onSend: (command: string) => void }) {
  return (
    <div style={styles.section}>
      <div style={styles.label}>Candles</div>
      <div style={styles.row}>
        <button style={styles.btn} onClick={() => onSend("1 minute candles")}>
          1m
        </button>
        <button style={styles.btn} onClick={() => onSend("30 minute candles")}>
          30m
        </button>
      </div>
    </div>
  );
}

// Same look as the remote's quick buttons.
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
    background: "#1a1a1a",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "0.75rem",
    color: "#f5f5f5",
    cursor: "pointer",
    fontSize: "1rem",
    padding: "0.75rem 1rem",
    minWidth: "5rem",
    touchAction: "manipulation",
  },
};
