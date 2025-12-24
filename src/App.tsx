import { useState, useEffect, useCallback } from 'react'
import FileTree from './components/FileTree'
import Editor from './components/Editor'
import EngineViewport from './components/EngineViewport'
import Hierarchy from './components/Hierarchy'
import Inspector from './components/Inspector'
import Chat from './components/Chat'
import AssetBrowser from './components/AssetBrowser'
import ExportDialog from './components/ExportDialog'
import HotReloadStatus from './components/HotReloadStatus'
import { useProjectStore } from './stores/projectStore'
import { useHistoryStore } from './stores/historyStore'

type ViewMode = 'viewport' | 'editor' | 'split'
type LeftPanel = 'files' | 'hierarchy' | 'assets'
type RightPanel = 'chat' | 'inspector'

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('viewport')
  const [leftPanel, setLeftPanel] = useState<LeftPanel>('hierarchy')
  const [rightPanel, setRightPanel] = useState<RightPanel>('inspector')
  const [showExportDialog, setShowExportDialog] = useState(false)
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
        <div className="titlebar-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ marginRight: '8px' }}>
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="url(#brandGradient)"/>
            <path d="M2 17L12 22L22 17" stroke="url(#brandGradient)" strokeWidth="2" strokeLinecap="round"/>
            <path d="M2 12L12 17L22 12" stroke="url(#brandGradient)" strokeWidth="2" strokeLinecap="round"/>
            <defs>
              <linearGradient id="brandGradient" x1="2" y1="2" x2="22" y2="22">
                <stop stopColor="#7c3aed"/>
                <stop offset="1" stopColor="#8b5cf6"/>
              </linearGradient>
            </defs>
          </svg>
          <h1>BUPS ENGINE</h1>
        </div>
        <div className="titlebar-project">
          <span className="project-label">Project:</span>
          <span className="project-name">{projectName || 'Untitled Project'}</span>
        </div>
        <div className="titlebar-actions">
          <button
            className={`titlebar-btn tooltip ${!canUndo ? 'disabled' : ''}`}
            onClick={undo}
            disabled={!canUndo}
            data-tooltip="Undo (Ctrl+Z)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6M3 13a9 9 0 1 0 2.5-6.3L3 7"/>
            </svg>
          </button>
          <button
            className={`titlebar-btn tooltip ${!canRedo ? 'disabled' : ''}`}
            onClick={redo}
            disabled={!canRedo}
            data-tooltip="Redo (Ctrl+Y)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6M21 13a9 9 0 1 1-2.5-6.3L21 7"/>
            </svg>
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <HotReloadStatus />
        <button
          className="export-btn tooltip"
          onClick={() => setShowExportDialog(true)}
          data-tooltip="Build and export your game"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
          Export
        </button>
        <div className="status-indicator">
          <div className="status-dot" />
          <span className="status-text">Running</span>
        </div>
      </div>

      {/* Left Panel */}
      <div className="panel left-panel">
        <div className="panel-tabs">
          <div
            className={`panel-tab ${leftPanel === 'hierarchy' ? 'active' : ''}`}
            onClick={() => setLeftPanel('hierarchy')}
            title="Scene objects and hierarchy"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h6v6H3zM15 3h6v6h-6zM9 15h6v6H9z"/>
              <path d="M6 9v3h3M18 9v6h-3"/>
            </svg>
            <span>Hierarchy</span>
          </div>
          <div
            className={`panel-tab ${leftPanel === 'assets' ? 'active' : ''}`}
            onClick={() => setLeftPanel('assets')}
            title="Project assets and resources"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 7h-9M14 17H5M17 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
            </svg>
            <span>Assets</span>
          </div>
          <div
            className={`panel-tab ${leftPanel === 'files' ? 'active' : ''}`}
            onClick={() => setLeftPanel('files')}
            title="Browse project files"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Files</span>
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
            title="3D scene editor"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span>3D Viewport</span>
          </div>
          <div
            className={`viewport-tab ${viewMode === 'editor' ? 'active' : ''}`}
            onClick={() => setViewMode('editor')}
            title="Script and code editor"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            <span>Code Editor</span>
          </div>
          <div
            className={`viewport-tab ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
            title="View both side by side"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="12" y1="3" x2="12" y2="21"/>
            </svg>
            <span>Split View</span>
          </div>
        </div>
        <div className="viewport-content">
          {viewMode === 'viewport' && <EngineViewport />}
          {viewMode === 'editor' && <Editor />}
          {viewMode === 'split' && (
            <div className="split-view">
              <div className="split-pane">
                <EngineViewport />
              </div>
              <div className="split-divider" />
              <div className="split-pane">
                <Editor />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="panel right-panel">
        <div className="panel-tabs">
          <div
            className={`panel-tab ${rightPanel === 'inspector' ? 'active' : ''}`}
            onClick={() => setRightPanel('inspector')}
            title="View and edit selected object properties"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Inspector</span>
          </div>
          <div
            className={`panel-tab ${rightPanel === 'chat' ? 'active' : ''}`}
            onClick={() => setRightPanel('chat')}
            title="Get AI assistance with your project"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>AI Assistant</span>
          </div>
        </div>
        <div className="panel-content">
          {rightPanel === 'inspector' && <Inspector />}
          {rightPanel === 'chat' && <Chat />}
        </div>
      </div>

      {/* Export Dialog */}
      {showExportDialog && <ExportDialog onClose={() => setShowExportDialog(false)} />}

      <style>{`
        .panel-tabs {
          display: flex;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          padding: 0 var(--spacing-xs);
        }
        .panel-tab {
          padding: 10px 14px;
          font-size: 11px;
          cursor: pointer;
          color: var(--text-muted);
          border-bottom: 2px solid transparent;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all var(--transition-normal);
          position: relative;
        }
        .panel-tab svg {
          opacity: 0.6;
          transition: opacity var(--transition-fast);
        }
        .panel-tab:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.02);
        }
        .panel-tab:hover svg {
          opacity: 0.9;
        }
        .panel-tab.active {
          color: var(--accent-light);
          border-bottom-color: var(--accent);
        }
        .panel-tab.active svg {
          opacity: 1;
        }

        /* Titlebar styling */
        .titlebar-brand {
          display: flex;
          align-items: center;
        }
        .titlebar-project {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-md);
          margin-left: 16px;
        }
        .project-label {
          color: var(--text-muted);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .project-name {
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 500;
        }
        .titlebar-actions {
          display: flex;
          gap: 6px;
          margin-left: 16px;
        }
        .titlebar-btn {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-normal);
        }
        .titlebar-btn:hover:not(.disabled) {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
          box-shadow: 0 2px 8px var(--accent-glow);
        }
        .titlebar-btn.disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .export-btn {
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          margin-right: 16px;
          transition: all var(--transition-normal);
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 2px 8px var(--accent-glow);
        }
        .export-btn:hover {
          box-shadow: 0 4px 12px var(--accent-glow);
          transform: translateY(-1px);
        }
        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .status-text {
          font-size: 11px;
          color: var(--success);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Viewport tabs */
        .viewport-tab {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .viewport-tab svg {
          opacity: 0.6;
        }
        .viewport-tab.active svg {
          opacity: 1;
        }

        /* Split view */
        .split-view {
          display: flex;
          height: 100%;
        }
        .split-pane {
          flex: 1;
          overflow: hidden;
        }
        .split-divider {
          width: 1px;
          background: var(--border-color);
        }

        /* Tooltip positioning */
        .titlebar .tooltip::after {
          bottom: auto;
          top: calc(100% + 8px);
        }
      `}</style>
    </div>
  )
}

export default App
