import { useEngineStore } from '../stores/engineStore'
import { Transform } from '../engine/core/Transform'
import { MeshRenderer } from '../engine/core/MeshRenderer'
import { Light } from '../engine/core/Light'
import { Camera } from '../engine/core/Camera'
import { RigidBody } from '../engine/physics/RigidBody'
import { ScriptComponent, scriptTemplates } from '../engine/scripting'
import { useState, useEffect, useCallback, memo } from 'react'

interface Vector3InputProps {
  label: string
  value: { x: number; y: number; z: number }
  onChange: (value: { x: number; y: number; z: number }) => void
  onFocus?: () => void
  onBlur?: () => void
}

const Vector3Input = memo(function Vector3Input({ label, value, onChange, onFocus, onBlur }: Vector3InputProps) {
  const handleXChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, x: parseFloat(e.target.value) || 0 })
  }, [value, onChange])

  const handleYChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, y: parseFloat(e.target.value) || 0 })
  }, [value, onChange])

  const handleZChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, z: parseFloat(e.target.value) || 0 })
  }, [value, onChange])

  return (
    <div className="vector3-input">
      <label>{label}</label>
      <div className="vector3-fields">
        <input
          type="number"
          step="0.1"
          value={value.x.toFixed(2)}
          onChange={handleXChange}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        <input
          type="number"
          step="0.1"
          value={value.y.toFixed(2)}
          onChange={handleYChange}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        <input
          type="number"
          step="0.1"
          value={value.z.toFixed(2)}
          onChange={handleZChange}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </div>
    </div>
  )
})

const TransformInspector = memo(function TransformInspector({ transform }: { transform: Transform }) {
  const [pos, setPos] = useState({ x: 0, y: 0, z: 0 })
  const [rot, setRot] = useState({ x: 0, y: 0, z: 0 })
  const [scale, setScale] = useState({ x: 1, y: 1, z: 1 })
  const [isEditing, setIsEditing] = useState(false)

  // Sync from transform when not editing (for gizmo updates)
  useEffect(() => {
    if (isEditing) return

    const syncFromTransform = () => {
      setPos({ x: transform.position.x, y: transform.position.y, z: transform.position.z })
      setRot({
        x: transform.rotation.x * (180 / Math.PI),
        y: transform.rotation.y * (180 / Math.PI),
        z: transform.rotation.z * (180 / Math.PI)
      })
      setScale({ x: transform.scale.x, y: transform.scale.y, z: transform.scale.z })
    }

    syncFromTransform()

    // Poll for gizmo updates - reduced from 50ms to 100ms for better performance
    const interval = setInterval(syncFromTransform, 100)
    return () => clearInterval(interval)
  }, [transform, isEditing])

  const updatePosition = useCallback((value: { x: number; y: number; z: number }) => {
    setPos(value)
    transform.setPosition(value.x, value.y, value.z)
  }, [transform])

  const updateRotation = useCallback((value: { x: number; y: number; z: number }) => {
    setRot(value)
    transform.setRotation(
      value.x * (Math.PI / 180),
      value.y * (Math.PI / 180),
      value.z * (Math.PI / 180)
    )
  }, [transform])

  const updateScale = useCallback((value: { x: number; y: number; z: number }) => {
    setScale(value)
    transform.setScale(value.x, value.y, value.z)
  }, [transform])

  const startEditing = useCallback(() => setIsEditing(true), [])
  const stopEditing = useCallback(() => setIsEditing(false), [])

  return (
    <div className="component-inspector">
      <div className="component-header">Transform</div>
      <Vector3Input
        label="Position"
        value={pos}
        onChange={updatePosition}
        onFocus={startEditing}
        onBlur={stopEditing}
      />
      <Vector3Input
        label="Rotation"
        value={rot}
        onChange={updateRotation}
        onFocus={startEditing}
        onBlur={stopEditing}
      />
      <Vector3Input
        label="Scale"
        value={scale}
        onChange={updateScale}
        onFocus={startEditing}
        onBlur={stopEditing}
      />
    </div>
  )
})

const LightInspector = memo(function LightInspector({ light }: { light: Light }) {
  const [intensity, setIntensity] = useState(light.intensity)
  const [color, setColor] = useState('#' + light.color.getHexString())

  const updateIntensity = useCallback((value: number) => {
    setIntensity(value)
    light.intensity = value
    light.updateLightProperties()
  }, [light])

  const updateColor = useCallback((value: string) => {
    setColor(value)
    light.color.setStyle(value)
    light.updateLightProperties()
  }, [light])

  const handleShadowChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    light.castShadow = e.target.checked
    light.updateShadowSettings()
  }, [light])

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
          onChange={handleShadowChange}
        />
      </div>
    </div>
  )
})

const CameraInspector = memo(function CameraInspector({ camera }: { camera: Camera }) {
  const [fov, setFov] = useState(camera.fov)

  const updateFov = useCallback((value: number) => {
    setFov(value)
    camera.fov = value
    camera.updateProjectionMatrix()
  }, [camera])

  const handleNearChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    camera.near = parseFloat(e.target.value)
    camera.updateProjectionMatrix()
  }, [camera])

  const handleFarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    camera.far = parseFloat(e.target.value)
    camera.updateProjectionMatrix()
  }, [camera])

  const handleMainChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    camera.isMain = e.target.checked
  }, [camera])

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
          onChange={handleNearChange}
        />
      </div>
      <div className="inspector-field">
        <label>Far</label>
        <input
          type="number"
          step="10"
          value={camera.far}
          onChange={handleFarChange}
        />
      </div>
      <div className="inspector-field">
        <label>Main Camera</label>
        <input
          type="checkbox"
          checked={camera.isMain}
          onChange={handleMainChange}
        />
      </div>
    </div>
  )
})

const ScriptInspector = memo(function ScriptInspector({ script }: { script: ScriptComponent }) {
  const [name, setName] = useState(script.scriptName)
  const [code, setCode] = useState(script.sourceCode)
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')

  const error = script.getError()

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode)
    script.setSourceCode(newCode)
  }, [script])

  const handleNameChange = useCallback((newName: string) => {
    setName(newName)
    script.scriptName = newName
  }, [script])

  const applyTemplate = useCallback((templateName: string) => {
    if (templateName && scriptTemplates[templateName as keyof typeof scriptTemplates]) {
      const templateCode = scriptTemplates[templateName as keyof typeof scriptTemplates]
      setCode(templateCode)
      script.setSourceCode(templateCode)
      setSelectedTemplate('')
    }
  }, [script])

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const handleEnabledChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    script.setEnabled(e.target.checked)
  }, [script])

  return (
    <div className="component-inspector script-inspector">
      <div
        className="component-header"
        onClick={toggleExpanded}
        style={{ cursor: 'pointer' }}
      >
        <span>{isExpanded ? '▼' : '▶'} Script: {name}</span>
        {error && <span className="script-error-badge">!</span>}
      </div>

      <div className="inspector-field">
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
        />
      </div>

      <div className="inspector-field">
        <label>Template</label>
        <select
          value={selectedTemplate}
          onChange={(e) => applyTemplate(e.target.value)}
        >
          <option value="">Select template...</option>
          <option value="empty">Empty Script</option>
          <option value="rotator">Rotator</option>
          <option value="playerController">Player Controller</option>
          <option value="follower">Follower</option>
          <option value="oscillator">Oscillator</option>
        </select>
      </div>

      {error && (
        <div className="script-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {isExpanded && (
        <div className="script-code-editor">
          <textarea
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="// Write your script here..."
            spellCheck={false}
          />
        </div>
      )}

      <div className="inspector-field">
        <label>Enabled</label>
        <input
          type="checkbox"
          checked={script.enabled}
          onChange={handleEnabledChange}
        />
      </div>
    </div>
  )
})

export default function Inspector() {
  const { selectedEntity } = useEngineStore()

  if (!selectedEntity) {
    return (
      <div className="inspector-panel">
        <div className="inspector-empty">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </div>
          <div className="empty-title">No object selected</div>
          <div className="empty-hint">Select an object from the Hierarchy panel to view and edit its properties</div>
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

  // Get all script components
  const scripts = selectedEntity.getAllComponents().filter(
    (c): c is ScriptComponent => c instanceof ScriptComponent
  )

  const addScript = () => {
    selectedEntity.addComponent(ScriptComponent, 'NewScript', scriptTemplates.empty)
  }

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

      {scripts.map((script, index) => (
        <ScriptInspector key={`script-${index}`} script={script} />
      ))}

      <button className="add-component-btn" onClick={addScript}>
        + Add Script
      </button>

      <style>{inspectorStyles}</style>
    </div>
  )
}

const inspectorStyles = `
  .inspector-panel {
    height: 100%;
    overflow-y: auto;
    padding: var(--spacing-md);
    background: var(--bg-primary);
  }
  .inspector-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl);
    text-align: center;
    height: 100%;
    min-height: 300px;
  }
  .inspector-empty .empty-icon {
    color: var(--text-muted);
    opacity: 0.4;
    margin-bottom: var(--spacing-lg);
  }
  .inspector-empty .empty-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-sm);
  }
  .inspector-empty .empty-hint {
    font-size: 12px;
    color: var(--text-muted);
    max-width: 200px;
    line-height: 1.6;
  }
  .inspector-header {
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-md);
    border: 1px solid var(--border-color);
  }
  .entity-name-input {
    width: 100%;
    padding: 10px 12px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
    margin-bottom: var(--spacing-sm);
    transition: all var(--transition-fast);
  }
  .entity-name-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  .active-checkbox {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
  }
  .active-checkbox:hover {
    color: var(--text-primary);
  }
  .component-inspector {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-md);
    overflow: hidden;
    transition: all var(--transition-normal);
  }
  .component-inspector:hover {
    border-color: var(--border-color);
  }
  .component-header {
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--bg-tertiary);
    font-size: 12px;
    font-weight: 600;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: var(--text-primary);
    letter-spacing: 0.3px;
  }
  .inspector-field {
    display: flex;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-lg);
    gap: var(--spacing-md);
    font-size: 12px;
    border-bottom: 1px solid var(--border-subtle);
  }
  .inspector-field:last-child {
    border-bottom: none;
  }
  .inspector-field label {
    width: 90px;
    color: var(--text-secondary);
    font-weight: 500;
    flex-shrink: 0;
  }
  .inspector-field input[type="number"],
  .inspector-field input[type="text"] {
    flex: 1;
    padding: 6px 10px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 12px;
    transition: all var(--transition-fast);
  }
  .inspector-field input[type="number"]:focus,
  .inspector-field input[type="text"]:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .inspector-field input[type="range"] {
    flex: 1;
    height: 4px;
    background: var(--bg-elevated);
    border-radius: 2px;
    cursor: pointer;
  }
  .inspector-field input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
  .inspector-field input[type="color"] {
    width: 36px;
    height: 28px;
    padding: 0;
    border: none;
    cursor: pointer;
    border-radius: var(--radius-sm);
  }
  .inspector-field span {
    min-width: 36px;
    text-align: right;
    color: var(--text-muted);
    font-size: 11px;
    font-family: monospace;
  }
  .vector3-input {
    padding: var(--spacing-sm) var(--spacing-lg);
    border-bottom: 1px solid var(--border-subtle);
  }
  .vector3-input:last-child {
    border-bottom: none;
  }
  .vector3-input label {
    display: flex;
    align-items: center;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 6px;
    font-weight: 500;
  }
  .vector3-fields {
    display: flex;
    gap: 6px;
  }
  .vector3-fields input {
    flex: 1;
    padding: 6px 10px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 12px;
    font-family: monospace;
    transition: all var(--transition-fast);
  }
  .vector3-fields input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .vector3-fields input:nth-child(1):focus { border-color: #ef4444; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2); }
  .vector3-fields input:nth-child(2):focus { border-color: #22c55e; box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2); }
  .vector3-fields input:nth-child(3):focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
  .add-component-btn {
    width: 100%;
    padding: 12px;
    background: transparent;
    border: 2px dashed var(--border-color);
    border-radius: var(--radius-lg);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    margin-top: var(--spacing-md);
    transition: all var(--transition-normal);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
  }
  .add-component-btn:hover {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--accent-light);
  }
  .script-inspector .component-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }
  .script-inspector .component-header:hover {
    background: var(--bg-elevated);
  }
  .script-error-badge {
    background: var(--error);
    color: white;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    animation: pulse-glow 2s ease-in-out infinite;
  }
  .script-error {
    padding: var(--spacing-md);
    background: rgba(239, 68, 68, 0.1);
    color: var(--error-light);
    font-size: 12px;
    border-left: 3px solid var(--error);
    margin: var(--spacing-sm);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }
  .script-code-editor {
    padding: var(--spacing-md);
  }
  .script-code-editor textarea {
    width: 100%;
    min-height: 180px;
    padding: 12px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', monospace;
    font-size: 12px;
    line-height: 1.6;
    resize: vertical;
    transition: all var(--transition-fast);
  }
  .script-code-editor textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  .inspector-field select {
    flex: 1;
    padding: 6px 10px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .inspector-field select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
`
