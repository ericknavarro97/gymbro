/**
 * App icon artwork for ImageResponse (apple-icon, manifest PNGs).
 * `inset` shrinks the plate for maskable icons (safe zone = 80%).
 */
export function AppIconArt({ size, inset = 0, rounded = false }: { size: number; inset?: number; rounded?: boolean }) {
  const plate = size * (1 - inset * 2);
  const ring = plate * 0.6;
  const stroke = plate * 0.08;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ff6a2b",
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      <div
        style={{
          width: ring,
          height: ring,
          borderRadius: "50%",
          border: `${stroke}px solid #170802`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: plate * 0.17, height: plate * 0.17, borderRadius: "50%", background: "#170802" }} />
      </div>
    </div>
  );
}
