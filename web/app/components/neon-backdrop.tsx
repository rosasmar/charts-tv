// The neon theme's backdrop: a dark navy sky that warms to purple at the
// bottom, with a faint pink glow on one side and a blue one on the other. Plain
// CSS gradients rendered on the server and only shown in the neon theme (see
// globals.css), so it costs a Fire TV GPU nothing after the first paint.
export function NeonBackdrop() {
  return (
    <div
      aria-hidden
      className="neon-backdrop pointer-events-none fixed -inset-[1rem] -z-20"
      style={{
        background: [
          "radial-gradient(60% 45% at 12% 100%, rgba(255, 61, 127, 0.28), transparent 70%)",
          "radial-gradient(60% 45% at 88% 100%, rgba(77, 171, 255, 0.24), transparent 70%)",
          "linear-gradient(to bottom, #05030f 0%, #0d0726 55%, #1c0b40 100%)",
        ].join(", "),
      }}
    />
  );
}
