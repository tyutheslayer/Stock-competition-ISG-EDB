// components/NeonBackground3D.jsx
import { Canvas } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { memo, Suspense } from "react";

function Scene() {
  return (
    <Float speed={1.2} rotationIntensity={0.6} floatIntensity={1.2}>
      <mesh>
        <torusKnotGeometry args={[1, 0.28, 96, 24]} />
        <meshStandardMaterial
          color="#579FD0"
          emissive="#00E5FF"
          emissiveIntensity={0.55}
          metalness={0.6}
          roughness={0.35}
          wireframe
        />
      </mesh>
    </Float>
  );
}

function NeonBackground3D({ className = "" }) {
  return (
    <div
      className={`fixed inset-0 pointer-events-none ${className}`}
      // isolation isole bien les z-index des descendants
      style={{ isolation: "isolate" }}
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "low-power" }}
        camera={{ position: [0, 0, 3.2], fov: 55 }}
      >
        <ambientLight intensity={0.25} />
        <pointLight position={[6, 6, 6]} intensity={0.6} />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default memo(NeonBackground3D);