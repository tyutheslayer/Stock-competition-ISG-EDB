// components/NeonBackground3D.jsx
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, PerformanceMonitor } from "@react-three/drei";
import { memo, Suspense, useMemo, useRef, useState } from "react";

// Petit mesh filaire (léger)
function FloatingKnot() {
  return (
    <Float speed={1.1} rotationIntensity={0.5} floatIntensity={1.1}>
      <mesh>
        <torusKnotGeometry args={[1, 0.28, 96, 24]} />
        <meshStandardMaterial
          color="#579FD0"
          emissive="#00E5FF"
          emissiveIntensity={0.5}
          metalness={0.6}
          roughness={0.35}
          wireframe
        />
      </mesh>
    </Float>
  );
}

// Lumière qui se déplace doucement pour accentuer le glassmorphism
function MovingLight() {
  const ref = useRef();
  const t0 = useMemo(() => performance.now(), []);
  useFrame(() => {
    const t = (performance.now() - t0) / 1000;
    // orbite lente
    const r = 6;
    const x = Math.cos(t * 0.15) * r;
    const y = 4 + Math.sin(t * 0.12) * 2;
    const z = 5 + Math.sin(t * 0.08) * 2;
    if (ref.current) ref.current.position.set(x, y, z);
  });
  return <pointLight ref={ref} intensity={0.6} />;
}

function NeonBackground3D() {
  const [dpr, setDpr] = useState([1, 1.4]); // adaptatif

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none opacity-[.85]">
      <Canvas
        dpr={dpr}
        gl={{ antialias: false, powerPreference: "low-power" }}
        camera={{ position: [0, 0, 3.2], fov: 55 }}
      >
        <PerformanceMonitor
          onIncline={() => setDpr([1, 1.6])}
          onDecline={() => setDpr([1, 1.1])}
        />
        <ambientLight intensity={0.25} />
        <MovingLight />
        <Suspense fallback={null}>
          <FloatingKnot />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default memo(NeonBackground3D);