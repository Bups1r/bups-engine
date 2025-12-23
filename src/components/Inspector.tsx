import { useEngineStore } from '../stores/engineStore'
import { Transform } from '../engine/core/Transform'
import { MeshRenderer } from '../engine/core/MeshRenderer'
import { Light } from '../engine/core/Light'
import { Camera } from '../engine/core/Camera'
import { RigidBody } from '../engine/physics/RigidBody'
import { useState, useEffect } from 'react'

interface Vector3InputProps {
  label: string
  value: { x: number; y: number; z: number }
  onChange: (value: { x: number; y: number; z: number }) => void
}

function Vector3Input({ label, value, onChange }: Vector3InputProps) {
  return (
    <div className="vector3-input">
      <label>{label}</label>
      <div className="vector3-fields">
        <input
          type="number"
          step="0.1"
          value={value.x.toFixed(2)}
          onChange={(e) => onChange({ ...value, x: parseFloat(e.target.value) || 0 })}
        />
        <input
          type="number"
          step="0.1"
          value={value.y.toFixed(2)}
          onChange={(e) => onChange({ ...value, y: parseFloat(e.target.value) || 0 })}
        />
        <input
          type="number"
          step="0.1"
          value={value.z.toFixed(2)}
          onChange={(e) => onChange({ ...value, z: parseFloat(e.target.value) || 0 })}
        />
      </div>
    </div>
  )
}

function TransformInspector({ transform }: { transform: Transform }) {
  const [pos, setPos] = useState({ x: 0, y: 0, z: 0 })
  const [rot, setRot] = useState({ x: 0, y: 0, z: 0 })
  const [scale, setScale] = useState({ x: 1, y: 1, z: 1 })

  useEffect(() => {
    setPos({ x: transform.position.x, y: transform.position.y, z: transform.position.z })
    setRot({
      x: transform.rotation.x * (180 / Math.PI),
      y: transform.rotation.y * (180 / Math.PI),
      z: transform.rotation.z * (180 / Math.PI)
    })
    setScale({ x: transform.scale.x, y: transform.scale.y, z: transform.scale.z })
  }, [transform])

  const updatePosition = (value: { x: number; y: number; z: number }) => {
    setPos(value)
    transform.setPosition(value.x, value.y, value.z)
  }

  const updateRotation = (value: { x: number; y: number; z: number }) => {
    setRot(value)
    transform.setRotation(
      value.x * (Math.PI / 180),
      value.y * (Math.PI / 180),
      value.z * (Math.PI / 180)
    )
  }

  const updateScale = (value: { x: number; y: number; z: number }) => {
    setScale(value)
    transform.setScale(value.x, value.y, value.z)
  }

  return (
    <div className="component-inspector">
      <div className="component-header">Transform</div>
      <Vector3Input label="Position" value={pos} onChange={updatePosition} />
      <Vector3Input label="Rotation" value={rot} onChange={updateRotation} />
      <Vector3Input label="Scale" value={scale} onChange={updateScale} />
    </div>
  )
}

function LightInspector({ light }: { light: Light }) {
  const [intensity, setIntensity] = useState(light.intensity)
  const [color, setColor] = useState('#' + light.color.getHexString())

  const updateIntensity = (value: number) => {
    setIntensity(value)
    light.intensity = value
    light.updateLightProperties()
  }

  const updateColor = (value: string) => {
    setColor(value)
    light.color.setStyle(value)
    light.updateLightProperties()
  }

  return (
    <div className="component-inspector">
      <div className="component-header">Light ({light.lightType})</div>
      <div className="inspector-field">
        <label>Intensity</label>
        <input
          type="range"
          min="0"
          max="10"
          step="0.1"
          value={intensity}
          onChange={(e) => updateIntensity(parseFloat(e.target.value))}
        />
        <span>{intensity.toFixed(1)}</span>
      </div>
      <div className="inspector-field">
        <label>Color</label>
        <input
          type="color"
          value={color}
          onChange={(e) => updateColor(e.target.value)}
        />
      </div>
      <div className="inspector-field">
        <label>Cast Shadow</label>
        <input
          type="checkbox"
          checked={light.castShadow}
          onChange={(e) => {
            light.castShadow = e.target.checked
            light.updateShadowSettings()
          }}
        />
      </div>
    </div>
  )
}

function CameraInspector({ camera }: { camera: Camera }) {
  const [fov, setFov] = useState(camera.fov)

  const updateFov = (value: number) => {
    setFov(value)
    camera.fov = value
    camera.updateProjectionMatrix()
  }

  return (
    <div className="component-inspector">
      <div className="component-header">Camera ({camera.cameraType})</div>
      <div className="inspector-field">
        <label>FOV</label>
        <input
          type="range"
          min="30"
          max="120"
          value={fov}
          onChange={(e) => updateFov(parseFloat(e.target.value))}
        />
        <span>{fov}°</span>
      </div>
      <div className="inspector-field">
        <label>Near</label>
        <input
          type="number"
          step="0.1"
          value={camera.near}
          onChange={(e) => {
            camera.near = parseFloat(e.target.value)
            camera.updateProjectionMatrix()
          }}
        />
      </div>
      <div className="inspector-field">
        <label>Far</label>
        <input
          type="number"
          step="10"
          value={camera.far}
          onChange={(e) => {
            camera.far = parseFloat(e.target.value)
            camera.updateProjectionMatrix()
          }}
        />
      </div>
      <div className="inspector-field">
        <label>Main Camera</label>
        <input
          type="checkbox"
          checked={camera.isMain}
          onChange={(e) => { camera.isMain = e.target.checked }}
        />
      </div>
    </div>
  )
}

export default function Inspector() {
  const { selectedEntity } = useEngineStore()
  const [, forceUpdate] = useState({})

  useEffect(() => {
    const interval = setInterval(() => forceUpdate({}), 100)
    return () => clearInterval(interval)
  }, [])

  if (!selectedEntity) {
    return (
      <div className="inspector-panel">
        <div className="inspector-empty">
          Select an entity to inspect
        </div>
        <style>{inspectorStyles}</style>
      </div>
    )
  }

  const transform = selectedEntity.getComponent(Transform)
  const meshRenderer = selectedEntity.getComponent(MeshRenderer)
  const light = selectedEntity.getComponent(Light)
  const camera = selectedEntity.getComponent(Camera)
  const rigidBody = selectedEntity.getComponent(RigidBody)

  return (
    <div className="inspector-panel">
      <div className="inspector-header">
        <input
          type="text"
          value={selectedEntity.name}
          onChange={(e) => { selectedEntity.name = e.target.value }}
          className="entity-name-input"
        />
        <label className="active-checkbox">
          <input
            type="checkbox"
            checked={selectedEntity.active}
            onChange={(e) => { selectedEntity.active = e.target.checked }}
          />
          Active
        </label>
      </div>

      {transform && <TransformInspector transform={transform} />}
      {light && <LightInspector light={light} />}
      {camera && <CameraInspector camera={camera} />}

      {meshRenderer && (
        <div className="component-inspector">
          <div className="component-header">Mesh Renderer</div>
          <div className="inspector-field">
            <label>Cast Shadow</label>
            <input
              type="checkbox"
              checked={meshRenderer.castShadow}
              onChange={(e) => { meshRenderer.castShadow = e.target.checked }}
            />
          </div>
          <div className="inspector-field">
            <label>Receive Shadow</label>
            <input
              type="checkbox"
              checked={meshRenderer.receiveShadow}
              onChange={(e) => { meshRenderer.receiveShadow = e.target.checked }}
            />
          </div>
        </div>
      )}

      {rigidBody && (
        <div className="component-inspector">
          <div className="component-header">Rigid Body ({rigidBody.bodyType})</div>
          <div className="inspector-field">
            <label>Mass</label>
            <input
              type="number"
              step="0.1"
              value={rigidBody.mass}
              onChange={(e) => { rigidBody.mass = parseFloat(e.target.value) }}
            />
          </div>
          <div className="inspector-field">
            <label>Use Gravity</label>
            <input
              type="checkbox"
              checked={rigidBody.useGravity}
              onChange={(e) => { rigidBody.useGravity = e.target.checked }}
            />
          </div>
        </div>
      )}

      <style>{inspectorStyles}</style>
    </div>
  )
}

const inspectorStyles = `
  .inspector-panel {
    height: 100%;
    overflow-y: auto;
    padding: 8px;
  }
  .inspector-empty {
    padding: 16px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 12px;
  }
  .inspector-header {
    padding: 8px;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 8px;
  }
  .entity-name-input {
    width: 100%;
    padding: 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 14px;
    margin-bottom: 8px;
  }
  .active-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .component-inspector {
    background: var(--bg-secondary);
    border-radius: 4px;
    margin-bottom: 8px;
    overflow: hidden;
  }
  .component-header {
    padding: 8px 12px;
    background: var(--bg-tertiary);
    font-size: 12px;
    font-weight: 600;
    border-bottom: 1px solid var(--border-color);
  }
  .inspector-field {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 8px;
    font-size: 12px;
  }
  .inspector-field label {
    width: 80px;
    color: var(--text-secondary);
  }
  .inspector-field input[type="number"],
  .inspector-field input[type="text"] {
    flex: 1;
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 12px;
  }
  .inspector-field input[type="range"] {
    flex: 1;
  }
  .inspector-field input[type="checkbox"] {
    width: 16px;
    height: 16px;
  }
  .inspector-field input[type="color"] {
    width: 40px;
    height: 24px;
    padding: 0;
    border: none;
    cursor: pointer;
  }
  .vector3-input {
    padding: 8px 12px;
  }
  .vector3-input label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }
  .vector3-fields {
    display: flex;
    gap: 4px;
  }
  .vector3-fields input {
    flex: 1;
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 12px;
    width: 60px;
  }
`
