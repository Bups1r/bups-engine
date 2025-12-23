import { useState, useEffect, useCallback } from 'react'
import FileTree from './components/FileTree'
import Editor from './components/Editor'
import EngineViewport from './components/EngineViewport'
import Hierarchy from './components/Hierarchy'
import Inspector from './components/Inspector'
import Chat from './components/Chat'
import AssetBrowser from './components/AssetBrowser'
import { useProjectStore } from './stores/projectStore'
import { useHistoryStore } from './stores/historyStore'

type ViewMode = 'viewport' | 'editor' | 'split'
type LeftPanel = 'files' | 'hierarchy' | 'assets'
type RightPanel = 'chat' | 'inspector'

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('viewport')
  const [leftPanel, setLeftPanel] = useState<LeftPanel>('hierarchy')
  const [rightPanel, setRightPanel] = useState<RightPanel>('inspector')
  const projectName = useProjectStore((s) => s.projectName)
  const { canUndo, canRedo, undo, redo } = useHistoryStore()

  // Keyboard shortcuts for undo/redo
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      if (e.shiftKey) {
        e.preventDefault()
        redo()
      } else {
        e.preventDefault()
        undo()
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault()
      redo()
    }
  }, [undo, redo])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="app-container">
      {/* Title Bar */}
      <div className="titlebar">
        <h1>BUPS ENGINE</h1>
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {projectName || 'Untitled Project'}
        </span>
        <div className="titlebar-actions">
          <button
            className={`titlebar-btn ${!canUndo ? 'disabled' : ''}`}
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            className={`titlebar-btn ${!canRedo ? 'disabled' : ''}`}
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <div className="status-dot" title="Engine Running" />
      </div>

      {/* Left Panel */}
      <div className="panel">
        <div className="panel-tabs">
          <div
            className={`panel-tab ${leftPanel === 'hierarchy' ? 'active' : ''}`}
            onClick={() => setLeftPanel('hierarchy')}
          >
            Hierarchy
          </div>
          <div
            className={`panel-tab ${leftPanel === 'assets' ? 'active' : ''}`}
            onClick={() => setLeftPanel('assets')}
          >
            Assets
          </div>
          <div
            className={`panel-tab ${leftPanel === 'files' ? 'active' : ''}`}
            onClick={() => setLeftPanel('files')}
          >
            Files
          </div>
        </div>
        <div className="panel-content">
          {leftPanel === 'hierarchy' && <Hierarchy />}
          {leftPanel === 'assets' && <AssetBrowser />}
          {leftPanel === 'files' && <FileTree />}
        </div>
      </div>

      {/* Main Editor/Viewport */}
      <div className="panel editor-viewport">
        <div className="viewport-tabs">
          <div
            className={`viewport-tab ${viewMode === 'viewport' ? 'active' : ''}`}
            onClick={() => setViewMode('viewport')}
          >
            3D Viewport
          </div>
          <div
            className={`viewport-tab ${viewMode === 'editor' ? 'active' : ''}`}
            onClick={() => setViewMode('editor')}
          >
            Code Editor
          </div>
          <div
            className={`viewport-tab ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
          >
            Split View
          </div>
        </div>
        <div className="viewport-content">
          {viewMode === 'viewport' && <EngineViewport />}
          {viewMode === 'editor' && <Editor />}
          {viewMode === 'split' && (
            <div style={{ display: 'flex', height: '100%' }}>
              <div style={{ flex: 1, borderRight: '1px solid var(--border-color)' }}>
                <EngineViewport />
              </div>
              <div style={{ flex: 1 }}>
                <Editor />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="panel">
        <div className="panel-tabs">
          <div
            className={`panel-tab ${rightPanel === 'inspector' ? 'active' : ''}`}
            onClick={() => setRightPanel('inspector')}
          >
            Inspector
          </div>
          <div
            className={`panel-tab ${rightPanel === 'chat' ? 'active' : ''}`}
            onClick={() => setRightPanel('chat')}
          >
            AI Chat
          </div>
        </div>
        <div className="panel-content">
          {rightPanel === 'inspector' && <Inspector />}
          {rightPanel === 'chat' && <Chat />}
        </div>
      </div>

      <style>{`
        .panel-tabs {
          display: flex;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }
        .panel-tab {
          padding: 8px 12px;
          font-size: 11px;
          cursor: pointer;
          color: var(--text-secondary);
          border-bottom: 2px solid transparent;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .panel-tab:hover {
          color: var(--text-primary);
        }
        .panel-tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }
        .titlebar-actions {
          display: flex;
          gap: 4px;
          margin-left: 16px;
        }
        .titlebar-btn {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          width: 28px;
          height: 28px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .titlebar-btn:hover:not(.disabled) {
          background: var(--accent);
          border-color: var(--accent);
        }
        .titlebar-btn.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}

export default App
