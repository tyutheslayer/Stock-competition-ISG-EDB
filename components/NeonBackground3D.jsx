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
          color="#66c2ff"
          emissive="#00d8ff"
          emissiveIntensity={0.45}
          metalness={0.55}
          roughness={0.4}
          wireframe
        />
      </mesh>
    </Float>
  );
}

function NeonBackground3D({ className = "" }) {
  return (
    <div className={`fixed inset-0 pointer-events-none opacity-80 ${className}`}>
      <Canvas dpr={[1, 1.5]} gl={{ antialias: true }} camera={{ position: [0, 0, 3.2], fov: 55 }}>
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