"use client";

export function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-15 pointer-events-none">
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(197, 168, 76, 0.2) 1px, transparent 1px),
          linear-gradient(90deg, rgba(197, 168, 76, 0.2) 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
        animation: "gridMove 30s linear infinite",
      }} />
      <style jsx>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(80px, 80px); }
        }
      `}</style>
      <div className="absolute inset-0" style={{
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(197, 168, 76, 0.03) 2px, rgba(197, 168, 76, 0.03) 4px)",
      }} />
    </div>
  );
}
