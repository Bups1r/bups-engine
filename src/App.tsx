import { useState } from 'react'
import FileTree from './components/FileTree'
import Editor from './components/Editor'
import Viewport from './components/Viewport'
import Chat from './components/Chat'
import { useProjectStore } from './stores/projectStore'

type ViewMode = 'viewport' | 'editor' | 'split'

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('viewport')
  const projectName = useProjectStore((s) => s.projectName)

  return (
    <div className="app-container">
      {/* Title Bar */}
      <div className="titlebar">
        <h1>BUPS ENGINE</h1>
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {projectName || 'Untitled Project'}
        </span>
        <div style={{ flex: 1 }} />
        <div className="status-dot" title="Claude Connected" />
      </div>

      {/* File Tree Panel */}
      <div className="panel">
        <div className="panel-header">Project Files</div>
        <div className="panel-content">
          <FileTree />
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
          {viewMode === 'viewport' && <Viewport />}
          {viewMode === 'editor' && <Editor />}
          {viewMode === 'split' && (
            <div style={{ display: 'flex', height: '100%' }}>
              <div style={{ flex: 1, borderRight: '1px solid var(--border-color)' }}>
                <Viewport />
              </div>
              <div style={{ flex: 1 }}>
                <Editor />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Panel */}
      <div className="panel">
        <div className="panel-header">AI Assistant</div>
        <div className="panel-content">
          <Chat />
        </div>
      </div>
    </div>
  )
}

export default App
