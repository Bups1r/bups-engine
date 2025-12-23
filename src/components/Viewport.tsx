import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, PerspectiveCamera } from '@react-three/drei'
import { Suspense } from 'react'

function Scene() {
  return (
    <>
      {/* Camera */}
      <PerspectiveCamera makeDefault position={[5, 5, 5]} />
      <OrbitControls enableDamping dampingFactor={0.05} />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />

      {/* Environment */}
      <Environment preset="night" />

      {/* Grid floor */}
      <Grid
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#3a3a5a"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#4a4a7a"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      {/* Demo cube */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#6366f1" />
      </mesh>

      {/* Demo sphere */}
      <mesh position={[2, 0.5, 0]} castShadow>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#22c55e" metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Demo cylinder */}
      <mesh position={[-2, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 1.5, 32]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.2} roughness={0.5} />
      </mesh>
    </>
  )
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#333" wireframe />
    </mesh>
  )
}

export default function Viewport() {
  return (
    <div className="viewport-3d" style={{ position: 'relative' }}>
      <Canvas shadows>
        <Suspense fallback={<LoadingFallback />}>
          <Scene />
        </Suspense>
      </Canvas>

      {/* Viewport overlay info */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        fontSize: 11,
        color: 'var(--text-secondary)',
        background: 'rgba(0,0,0,0.5)',
        padding: '4px 8px',
        borderRadius: 4,
      }}>
        Orbit: Left Click | Pan: Right Click | Zoom: Scroll
      </div>
    </div>
  )
}
