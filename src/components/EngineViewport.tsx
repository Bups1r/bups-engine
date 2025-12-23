import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Engine } from '../engine'
import { Transform } from '../engine/core/Transform'
import { Light } from '../engine/core/Light'
import { MeshRenderer } from '../engine/core/MeshRenderer'
import { useEngineStore } from '../stores/engineStore'

export default function EngineViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { setEngine, updateStats, isPlaying, setPlaying } = useEngineStore()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!canvasRef.current || initialized) return

    const engine = new Engine({
      canvas: canvasRef.current,
      antialias: true,
      shadows: true
    })

    // Create default scene
    setupDefaultScene(engine)

    // Store engine
    setEngine(engine)
    setInitialized(true)

    // Start engine
    engine.start()
    setPlaying(true)

    // Update stats
    const statsInterval = setInterval(() => {
      updateStats()
    }, 500)

    // Handle resize
    const handleResize = () => {
      if (containerRef.current && engine) {
        const { clientWidth, clientHeight } = containerRef.current
        engine.setSize(clientWidth, clientHeight)
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    handleResize()

    return () => {
      clearInterval(statsInterval)
      resizeObserver.disconnect()
      engine.dispose()
    }
  }, [initialized, setEngine, setPlaying, updateStats])

  return (
    <div ref={containerRef} className="engine-viewport">
      <canvas ref={canvasRef} />

      {/* Viewport toolbar */}
      <div className="viewport-toolbar">
        <button
          className={`toolbar-btn ${isPlaying ? 'active' : ''}`}
          onClick={() => setPlaying(!isPlaying)}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>

      {/* Stats overlay */}
      <StatsOverlay />

      <style>{`
        .engine-viewport {
          width: 100%;
          height: 100%;
          position: relative;
          background: #000;
        }
        .engine-viewport canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
        .viewport-toolbar {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 4px;
          background: rgba(0, 0, 0, 0.7);
          padding: 4px;
          border-radius: 4px;
        }
        .toolbar-btn {
          width: 32px;
          height: 32px;
          border: none;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .toolbar-btn:hover {
          background: var(--bg-secondary);
        }
        .toolbar-btn.active {
          background: var(--accent);
        }
      `}</style>
    </div>
  )
}

function StatsOverlay() {
  const { stats } = useEngineStore()

  return (
    <div className="stats-overlay">
      <div>FPS: {stats.fps}</div>
      <div>Entities: {stats.entities}</div>
      <div>Draw Calls: {stats.drawCalls}</div>
      <div>Triangles: {stats.triangles.toLocaleString()}</div>

      <style>{`
        .stats-overlay {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.7);
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-family: monospace;
          color: #0f0;
        }
        .stats-overlay div {
          margin: 2px 0;
        }
      `}</style>
    </div>
  )
}

function setupDefaultScene(engine: Engine) {
  // Camera
  const camera = engine.createCamera('Main Camera', true)
  const camTransform = camera.getComponent(Transform)
  camTransform?.setPosition(5, 5, 5)
  camTransform?.lookAt(new THREE.Vector3(0, 0, 0))
  camera.addTag('camera')

  // Directional light
  const dirLight = engine.createLight('Directional Light', 'directional')
  const dirTransform = dirLight.getComponent(Transform)
  dirTransform?.setPosition(5, 10, 5)
  dirLight.addTag('light')

  // Ambient light
  const ambLight = engine.createLight('Ambient Light', 'ambient')
  const ambLightComp = ambLight.getComponent(Light)
  if (ambLightComp) {
    ambLightComp.intensity = 0.4
    ambLightComp.updateLightProperties()
  }
  ambLight.addTag('light')

  // Ground plane
  const ground = engine.createPlane('Ground', 20, 20)
  const groundMesh = ground.getComponent(MeshRenderer)
  if (groundMesh?.mesh?.material) {
    (groundMesh.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x333333)
  }

  // Demo cube
  const cube = engine.createBox('Cube', new THREE.Vector3(1, 1, 1))
  const cubeTransform = cube.getComponent(Transform)
  cubeTransform?.setPosition(0, 0.5, 0)
  const cubeMesh = cube.getComponent(MeshRenderer)
  if (cubeMesh?.mesh?.material) {
    (cubeMesh.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x6366f1)
  }

  // Demo sphere
  const sphere = engine.createSphere('Sphere', 0.5)
  const sphereTransform = sphere.getComponent(Transform)
  sphereTransform?.setPosition(2, 0.5, 0)
  const sphereMesh = sphere.getComponent(MeshRenderer)
  if (sphereMesh?.mesh?.material) {
    (sphereMesh.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x22c55e)
  }
}
