import { useState, useEffect, useCallback, memo } from 'react'
import { useEngineStore } from '../stores/engineStore'
import { Entity } from '../engine/ecs/Entity'
import { commandHistory, CreateEntityCommand, DeleteEntityCommand } from '../engine/editor'

interface HierarchyItemProps {
  entity: Entity
  depth: number
  selectedEntityId: string | null
  onSelect: (entity: Entity) => void
}

const HierarchyItem = memo(function HierarchyItem({ entity, depth, selectedEntityId, onSelect }: HierarchyItemProps) {
  const [expanded, setExpanded] = useState(true)
  const isSelected = selectedEntityId === entity.id
  const hasChildren = entity.children.length > 0

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(prev => !prev)
  }, [])

  const handleSelect = useCallback(() => {
    onSelect(entity)
  }, [entity, onSelect])

  return (
    <>
      <div
        className={`hierarchy-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleSelect}
      >
        {hasChildren && (
          <span
            className="expand-icon"
            onClick={handleToggleExpand}
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
        <HierarchyItem
          key={child.id}
          entity={child}
          depth={depth + 1}
          selectedEntityId={selectedEntityId}
          onSelect={onSelect}
        />
      ))}
    </>
  )
})

export default function Hierarchy() {
  const { engine, selectedEntity, selectEntity } = useEngineStore()
  const [entities, setEntities] = useState<Entity[]>([])
  const [, forceUpdate] = useState(0)

  // Stable callback for selecting entities
  const handleSelectEntity = useCallback((entity: Entity) => {
    selectEntity(entity)
  }, [selectEntity])

  useEffect(() => {
    if (!engine) return

    const updateEntities = () => {
      setEntities(engine.world.getRootEntities())
    }

    // Initial load
    updateEntities()

    // Subscribe to world changes via custom event
    const handleWorldChange = () => {
      updateEntities()
      forceUpdate(n => n + 1)
    }

    // Listen for entity changes
    window.addEventListener('engine:world-changed', handleWorldChange)

    // Fallback: poll less frequently (2 seconds instead of 500ms)
    // This catches any changes not emitted as events
    const interval = setInterval(updateEntities, 2000)

    return () => {
      window.removeEventListener('engine:world-changed', handleWorldChange)
      clearInterval(interval)
    }
  }, [engine])

  const handleAddEntity = (type: string) => {
    if (!engine) return

    let entity: Entity | null = null

    switch (type) {
      case 'empty':
        entity = engine.createEntity('Empty')
        break
      case 'cube':
        entity = engine.createBox('Cube')
        break
      case 'sphere':
        entity = engine.createSphere('Sphere')
        break
      case 'plane':
        entity = engine.createPlane('Plane')
        break
      case 'light':
        entity = engine.createLight('Light', 'point')
        entity.addTag('light')
        break
      case 'camera':
        entity = engine.createCamera('Camera', false)
        entity.addTag('camera')
        break
    }

    if (entity) {
      // Create command for undo support (entity already created, just track it)
      const command = new CreateEntityCommand(engine, entity)
      commandHistory.push(command)
    }

    setEntities(engine.world.getRootEntities())
  }

  const handleDeleteEntity = useCallback((entity: Entity) => {
    if (!engine) return

    const command = new DeleteEntityCommand(engine, entity)
    commandHistory.execute(command)

    // Deselect if deleted entity was selected
    if (selectedEntity?.id === entity.id) {
      selectEntity(null)
    }

    setEntities(engine.world.getRootEntities())
  }, [engine, selectedEntity, selectEntity])

  // Keyboard shortcut for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'Delete' && selectedEntity) {
        handleDeleteEntity(selectedEntity)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedEntity, handleDeleteEntity])

  return (
    <div className="hierarchy-panel">
      <div className="hierarchy-toolbar">
        <button onClick={() => handleAddEntity('empty')} title="Add Empty">+</button>
        <button onClick={() => handleAddEntity('cube')} title="Add Cube">◻</button>
        <button onClick={() => handleAddEntity('sphere')} title="Add Sphere">○</button>
        <button onClick={() => handleAddEntity('light')} title="Add Light">💡</button>
        <div style={{ flex: 1 }} />
        {selectedEntity && (
          <button
            onClick={() => handleDeleteEntity(selectedEntity)}
            title="Delete Selected (Del)"
            className="delete-btn"
          >
            🗑
          </button>
        )}
      </div>
      <div className="hierarchy-list">
        {entities.map((entity) => (
          <HierarchyItem
            key={entity.id}
            entity={entity}
            depth={0}
            selectedEntityId={selectedEntity?.id ?? null}
            onSelect={handleSelectEntity}
          />
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
        .delete-btn:hover {
          background: #dc2626 !important;
          border-color: #dc2626 !important;
        }
      `}</style>
    </div>
  )
}
