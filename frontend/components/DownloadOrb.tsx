"use client";

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

    // Gentle floating animation
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(time * 0.8) * 0.12;
    }

    // Rotation - slow and smooth
    if (sphereRef.current) {
      sphereRef.current.rotation.y = time * 0.25;
      sphereRef.current.rotation.x = Math.sin(time * 0.3) * 0.1;
    }

    // Progress ring rotation
    if (ringRef.current) {
      ringRef.current.rotation.z = (progress / 100) * Math.PI * 2 - Math.PI / 2;
    }
  });

  // Color based on status
  const sphereColor = status === 'completed' ? '#22c55e' : 
                     status === 'error' ? '#ef4444' : 
                     isDownloading ? '#3b82f6' : '#52525b';

  return (
    <group ref={groupRef}>
      {/* Main Sphere */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[1.6]} />
        <meshPhongMaterial 
          color={sphereColor} 
          shininess={90} 
          specular="#ffffff" 
          emissive={sphereColor} 
          emissiveIntensity={0.08} 
        />
      </mesh>

      {/* Subtle wireframe layer */}
      <mesh>
        <sphereGeometry args={[1.65]} />
        <meshBasicMaterial 
          color="#ffffff" 
          wireframe 
          transparent 
          opacity={0.12} 
        />
      </mesh>

      {/* Progress Ring */}
      <group ref={ringRef}>
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[2.05, 2.2, 64, 1, 0, (progress / 100) * Math.PI * 2]} />
          <meshBasicMaterial color="#3b82f6" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Small accent dots */}
      {[0, 1, 2].map((i) => (
        <mesh 
          key={i} 
          position={[
            Math.cos(i * 2.1) * 2.35, 
            Math.sin(i * 1.7) * 1.1, 
            0
          ]}
        >
          <sphereGeometry args={[0.07]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

export default function DownloadOrb({ progress = 0, status = 'idle' }: DownloadOrbProps) {
  const [hovered, setHovered] = useState(false);

  const statusText = status === 'downloading' ? 'DOWNLOADING' : 
                     status === 'completed' ? 'COMPLETE' : 
                     status === 'error' ? 'ERROR' : 'READY';

  return (
    <div 
      className="orb-container relative cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative w-[220px] h-[220px]">
        <Canvas 
          camera={{ position: [0, 0, 6.5], fov: 42 }} 
          style={{ background: 'transparent' }}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 15, -10]} intensity={1.8} color="#ffffff" />
          <pointLight position={[-8, -12, 10]} intensity={0.8} color="#64748b" />

          <OrbMesh progress={progress} status={status} />

          <OrbitControls 
            enableZoom={false} 
            enablePan={false} 
            enableRotate={hovered}
            autoRotate={!hovered}
            autoRotateSpeed={0.3}
          />
        </Canvas>

        {/* Overlay UI */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-[42px] font-semibold tabular-nums tracking-[-3.5px] text-white/95">
              {Math.floor(progress)}<span className="text-2xl align-super">%</span>
            </div>
            <div className="text-[10px] font-mono tracking-[3px] text-white/40 -mt-1">
              {statusText}
            </div>
          </div>
        </div>
      </div>

      {/* Subtle interaction hint */}
      {hovered && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/40 font-mono tracking-widest">
          DRAG TO ROTATE
        </div>
      )}
    </div>
  );
}
