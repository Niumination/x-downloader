import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface DownloadOrbProps {
  progress: number;
  status: string;
}

function OrbMesh({ progress, status }: { progress: number; status: string }) {
  const groupRef = useRef<THREE.Group>(null!);
  const sphereRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Group>(null!);

  const isDownloading = status === 'downloading' || status === 'pending';

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (groupRef.current) groupRef.current.position.y = Math.sin(time * 0.8) * 0.12;
    if (sphereRef.current) {
      sphereRef.current.rotation.y = time * 0.25;
      sphereRef.current.rotation.x = Math.sin(time * 0.3) * 0.1;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = (progress / 100) * Math.PI * 2 - Math.PI / 2;
    }
  });

  const sphereColor = status === 'completed' ? '#22c55e' : 
                     status === 'error' ? '#ef4444' : 
                     isDownloading ? '#3b82f6' : '#52525b';

  return (
    <group ref={groupRef}>
      <mesh ref={sphereRef}>
        <sphereGeometry args={[1.6]} />
        <meshPhongMaterial color={sphereColor} shininess={90} specular="#ffffff" emissive={sphereColor} emissiveIntensity={0.08} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.65]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.12} />
      </mesh>
      <group ref={ringRef}>
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[2.05, 2.2, 64, 1, 0, (progress / 100) * Math.PI * 2]} />
          <meshBasicMaterial color="#3b82f6" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

export default function DownloadOrb({ progress = 0, status = 'idle' }: DownloadOrbProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ width: '220px', height: '220px', position: 'relative', cursor: 'pointer' }}
         onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Canvas camera={{ position: [0, 0, 6.5], fov: 42 }} style={{ background: 'transparent' }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 15, -10]} intensity={1.8} color="#ffffff" />
        <pointLight position={[-8, -12, 10]} intensity={0.8} color="#64748b" />
        <OrbMesh progress={progress} status={status} />
        <OrbitControls enableZoom={false} enablePan={false} enableRotate={hovered} autoRotate={!hovered} autoRotateSpeed={0.3} />
      </Canvas>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '42px', fontWeight: 600, lineHeight: 1 }}>
            {Math.floor(progress)}<span style={{ fontSize: '20px', verticalAlign: 'super' }}>%</span>
          </div>
          <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#71717a', marginTop: '-4px' }}>
            {status === 'downloading' ? 'DOWNLOADING' : status === 'completed' ? 'COMPLETE' : status === 'error' ? 'ERROR' : 'READY'}
          </div>
        </div>
      </div>
    </div>
  );
}