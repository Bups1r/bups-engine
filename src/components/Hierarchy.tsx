import { useEngineStore } from '../stores/engineStore'
import { Entity } from '../engine/ecs/Entity'
import { useState, useEffect } from 'react'

interface HierarchyItemProps {
  entity: Entity
  depth: number
}

function HierarchyItem({ entity, depth }: HierarchyItemProps) {
  const [expanded, setExpanded] = useState(true)
  const { selectedEntity, selectEntity } = useEngineStore()
  const isSelected = selectedEntity?.id === entity.id
  const hasChildren = entity.children.length > 0

  return (
    <>
      <div
        className={`hierarchy-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => selectEntity(entity)}
      >
        {hasChildren && (
          <span
            className="expand-icon"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            {expanded ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && <span className="expand-icon" />}
        <span className="entity-icon">
          {entity.hasTag('camera') ? '📷' : entity.hasTag('light') ? '💡' : '🎮'}
        </span>
        <span className="entity-name">{entity.name}</span>
      </div>
      {expanded && entity.children.map((child) => (
        <HierarchyItem key={child.id} entity={child} depth={depth + 1} />
      ))}
    </>
  )
}

export default function Hierarchy() {
  const { engine } = useEngineStore()
  const [entities, setEntities] = useState<Entity[]>([])

  useEffect(() => {
    if (!engine) return

    const updateEntities = () => {
      setEntities(engine.world.getRootEntities())
    }

    updateEntities()
    const interval = setInterval(updateEntities, 500)

    return () => clearInterval(interval)
  }, [engine])

  const handleAddEntity = (type: string) => {
    if (!engine) return

    switch (type) {
      case 'empty':
        engine.createEntity('Empty')
        break
      case 'cube':
        engine.createBox('Cube')
        break
      case 'sphere':
        engine.createSphere('Sphere')
        break
      case 'plane':
        engine.createPlane('Plane')
        break
      case 'light':
        const light = engine.createLight('Light', 'point')
        light.addTag('light')
        light.getComponent(engine.world.getEntitiesWithComponents()[0]?.getComponent as never)
        break
      case 'camera':
        const cam = engine.createCamera('Camera', false)
        cam.addTag('camera')
        break
    }

    setEntities(engine.world.getRootEntities())
  }

  return (
    <div className="hierarchy-panel">
      <div className="hierarchy-toolbar">
        <button onClick={() => handleAddEntity('empty')} title="Add Empty">+</button>
        <button onClick={() => handleAddEntity('cube')} title="Add Cube">◻</button>
        <button onClick={() => handleAddEntity('sphere')} title="Add Sphere">○</button>
        <button onClick={() => handleAddEntity('light')} title="Add Light">💡</button>
      </div>
      <div className="hierarchy-list">
        {entities.map((entity) => (
          <HierarchyItem key={entity.id} entity={entity} depth={0} />
        ))}
        {entities.length === 0 && (
          <div className="hierarchy-empty">
            No entities in scene
          </div>
        )}
      </div>

      <style>{`
        .hierarchy-panel {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .hierarchy-toolbar {
          padding: 8px;
          display: flex;
          gap: 4px;
          border-bottom: 1px solid var(--border-color);
        }
        .hierarchy-toolbar button {
          padding: 4px 8px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-primary);
          cursor: pointer;
          font-size: 12px;
        }
        .hierarchy-toolbar button:hover {
          background: var(--bg-secondary);
        }
        .hierarchy-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }
        .hierarchy-item {
          display: flex;
          align-items: center;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 13px;
          gap: 4px;
        }
        .hierarchy-item:hover {
          background: var(--bg-tertiary);
        }
        .hierarchy-item.selected {
          background: var(--accent);
          color: white;
        }
        .expand-icon {
          width: 16px;
          font-size: 10px;
          text-align: center;
        }
        .entity-icon {
          font-size: 12px;
        }
        .entity-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .hierarchy-empty {
          padding: 16px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 12px;
        }
      `}</style>
    </div>
  )
}
