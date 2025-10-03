import React from "react";

export default function NeonBackground3D({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* dégradés néon */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          aria-hidden
          className="absolute -top-32 -left-24 h-96 w-96 rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, #00E5FF 0%, rgba(0,229,255,0) 70%)" }}
        />
        <div
          aria-hidden
          className="absolute bottom-[-120px] right-[-120px] h-[420px] w-[420px] rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, #579FD0 0%, rgba(87,159,208,0) 70%)" }}
        />
        <div
          aria-hidden
          className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[600px] w-[900px] blur-[90px] opacity-20"
          style={{ background: "conic-gradient(from 180deg at 50% 50%, #00E5FF, #FF8A00, #579FD0, #00E5FF)" }}
        />
      </div>

      {/* grille filaire subtile */}
      <svg
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00E5FF" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* contenu */}
      <div className="relative">{children}</div>
    </div>
  );
}