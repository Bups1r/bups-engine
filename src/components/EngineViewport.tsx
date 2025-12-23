import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
// @ts-ignore - Three.js examples have limited type support
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { Engine } from '../engine'
import { Transform } from '../engine/core/Transform'
import { Light } from '../engine/core/Light'
import { MeshRenderer } from '../engine/core/MeshRenderer'
import { TransformGizmo, commandHistory, TransformCommand } from '../engine/editor'
import { getHotReload } from '../engine/scripting/HotReload'
import { useEngineStore } from '../stores/engineStore'
import { Entity } from '../engine/ecs/Entity'

// Track transform state for undo/redo
let transformStartState: { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 } | null = null

export default function EngineViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gizmoRef = useRef<TransformGizmo | null>(null)
  const orbitRef = useRef<OrbitControls | null>(null)

  const {
    setEngine,
    updateStats,
    isPlaying,
    setPlaying,
    selectedEntity,
    gizmoMode,
    gizmoSpace,
    gizmoEnabled,
    setGizmoMode,
    toggleGizmoSpace
  } = useEngineStore()

  const [initialized, setInitialized] = useState(false)

  // Keyboard shortcuts for gizmo modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'w':
          setGizmoMode('translate')
          break
        case 'e':
          setGizmoMode('rotate')
          break
        case 'r':
          setGizmoMode('scale')
          break
        case 'q':
          toggleGizmoSpace()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setGizmoMode, toggleGizmoSpace])

  // Sync gizmo with selected entity
  useEffect(() => {
    if (gizmoRef.current) {
      gizmoRef.current.attach(selectedEntity)
    }
  }, [selectedEntity])

  // Sync gizmo mode
  useEffect(() => {
    if (gizmoRef.current) {
      gizmoRef.current.mode = gizmoMode
    }
  }, [gizmoMode])

  // Sync gizmo space
  useEffect(() => {
    if (gizmoRef.current) {
      gizmoRef.current.space = gizmoSpace
    }
  }, [gizmoSpace])

  // Sync gizmo enabled state
  useEffect(() => {
    if (gizmoRef.current) {
      gizmoRef.current.enabled = gizmoEnabled
    }
  }, [gizmoEnabled])

  useEffect(() => {
    if (!canvasRef.current || initialized) return

    const engine = new Engine({
      canvas: canvasRef.current,
      antialias: true,
      shadows: true
    })

    // Create default scene
    setupDefaultScene(engine)

    // Initialize hot reload system
    const hotReload = getHotReload({
      pollInterval: 1000,
      enabled: true
    })
    hotReload.initialize(engine.world)

    // Store engine
    setEngine(engine)
    setInitialized(true)

    // Get camera and scene for gizmo/orbit controls
    const scene = engine.renderSystem.getScene()
    const renderer = engine.renderSystem.getRenderer()

    // Find the main camera
    const cameraEntities = engine.world.getEntitiesWithTag('camera')
    let threeCamera: THREE.Camera | null = null

    for (const camEntity of cameraEntities) {
      const camComp = camEntity.getComponent(Transform)
      if (camComp) {
        // Create an editor camera that mirrors the main camera
        const editorCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
        editorCamera.position.set(5, 5, 5)
        editorCamera.lookAt(0, 0, 0)
        threeCamera = editorCamera
        scene.add(editorCamera)
        break
      }
    }

    if (!threeCamera) {
      // Fallback camera
      threeCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
      threeCamera.position.set(5, 5, 5)
      threeCamera.lookAt(0, 0, 0)
      scene.add(threeCamera)
    }

    // Create orbit controls
    const orbitControls = new OrbitControls(threeCamera, renderer.domElement)
    orbitControls.enableDamping = true
    orbitControls.dampingFactor = 0.1
    orbitControls.target.set(0, 0, 0)
    orbitRef.current = orbitControls

    // Create transform gizmo
    const gizmo = new TransformGizmo(threeCamera, renderer.domElement, scene)
    gizmoRef.current = gizmo

    // Set up transform events for undo/redo
    gizmo.setEvents({
      onTransformStart: (entity: Entity) => {
        const transform = entity.getComponent(Transform)
        if (transform) {
          transformStartState = {
            position: transform.position.clone(),
            rotation: transform.rotation.clone(),
            scale: transform.scale.clone()
          }
        }
      },
      onTransformEnd: (entity: Entity) => {
        const transform = entity.getComponent(Transform)
        if (transform && transformStartState) {
          const newState = {
            position: transform.position.clone(),
            rotation: transform.rotation.clone(),
            scale: transform.scale.clone()
          }

          // Only create command if something actually changed
          if (
            !transformStartState.position.equals(newState.position) ||
            !transformStartState.rotation.equals(newState.rotation) ||
            !transformStartState.scale.equals(newState.scale)
          ) {
            const command = new TransformCommand(entity, transformStartState, newState)
            // Use push - transform is already applied, just add to history
            commandHistory.push(command)
          }
          transformStartState = null
        }
      }
    })

    // Disable orbit controls while dragging gizmo
    renderer.domElement.addEventListener('gizmo-dragging', ((e: CustomEvent) => {
      orbitControls.enabled = !e.detail.dragging
    }) as EventListener)

    // Start engine
    engine.start()
    setPlaying(true)

    // Update loop for orbit controls
    const updateOrbit = () => {
      orbitControls.update()
    }
    engine.onUpdate(updateOrbit)

    // Update stats
    const statsInterval = setInterval(() => {
      updateStats()
    }, 500)

    // Handle resize
    const handleResize = () => {
      if (containerRef.current && engine) {
        const { clientWidth, clientHeight } = containerRef.current
        engine.setSize(clientWidth, clientHeight)

        if (threeCamera instanceof THREE.PerspectiveCamera) {
          threeCamera.aspect = clientWidth / clientHeight
          threeCamera.updateProjectionMatrix()
        }
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
      engine.offUpdate(updateOrbit)
      gizmo.dispose()
      orbitControls.dispose()
      hotReload.dispose()
      engine.dispose()
    }
  }, [initialized, setEngine, setPlaying, updateStats])

  return (
    <div ref={containerRef} className="engine-viewport">
      <canvas ref={canvasRef} />

      {/* Viewport toolbar */}
      <div className="viewport-toolbar">
        {/* Play/Pause */}
        <button
          className={`toolbar-btn ${isPlaying ? 'active' : ''}`}
          onClick={() => setPlaying(!isPlaying)}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div className="toolbar-separator" />

        {/* Gizmo mode buttons */}
        <button
          className={`toolbar-btn ${gizmoMode === 'translate' ? 'active' : ''}`}
          onClick={() => setGizmoMode('translate')}
          title="Translate (W)"
        >
          ✥
        </button>
        <button
          className={`toolbar-btn ${gizmoMode === 'rotate' ? 'active' : ''}`}
          onClick={() => setGizmoMode('rotate')}
          title="Rotate (E)"
        >
          ⟳
        </button>
        <button
          className={`toolbar-btn ${gizmoMode === 'scale' ? 'active' : ''}`}
          onClick={() => setGizmoMode('scale')}
          title="Scale (R)"
        >
          ⤢
        </button>

        <div className="toolbar-separator" />

        {/* Space toggle */}
        <button
          className="toolbar-btn"
          onClick={toggleGizmoSpace}
          title={`Toggle Space (Q) - Currently: ${gizmoSpace}`}
        >
          {gizmoSpace === 'world' ? '🌍' : '📦'}
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
        .toolbar-separator {
          width: 1px;
          height: 20px;
          background: rgba(255, 255, 255, 0.2);
          margin: 0 4px;
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
