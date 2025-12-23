import MonacoEditor from '@monaco-editor/react'
import { useProjectStore, FileNode } from '../stores/projectStore'

function findFileContent(files: FileNode[], path: string): string | undefined {
  for (const file of files) {
    if (file.path === path) {
      return file.content
    }
    if (file.children) {
      const found = findFileContent(file.children, path)
      if (found !== undefined) return found
    }
  }
  return undefined
}

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'js':
    case 'jsx':
      return 'javascript'
    case 'json':
      return 'json'
    case 'css':
      return 'css'
    case 'html':
      return 'html'
    case 'md':
      return 'markdown'
    default:
      return 'plaintext'
  }
}

export default function Editor() {
  const { activeFile, files, openFiles, closeFile, setActiveFile, updateFileContent } = useProjectStore()

  const content = activeFile ? findFileContent(files, activeFile) : undefined
  const filename = activeFile?.split('/').pop() || ''
  const language = getLanguage(filename)

  const handleChange = (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      updateFileContent(activeFile, value)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Open file tabs */}
      {openFiles.length > 0 && (
        <div style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto',
        }}>
          {openFiles.map((path) => {
            const name = path.split('/').pop()
            return (
              <div
                key={path}
                onClick={() => setActiveFile(path)}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: activeFile === path ? 'var(--bg-primary)' : 'transparent',
                  borderRight: '1px solid var(--border-color)',
                  color: activeFile === path ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <span>{name}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    closeFile(path)
                  }}
                  style={{
                    opacity: 0.5,
                    fontSize: '14px',
                  }}
                >
                  ×
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Editor */}
      <div style={{ flex: 1 }}>
        {activeFile ? (
          <MonacoEditor
            height="100%"
            language={language}
            value={content || ''}
            onChange={handleChange}
            theme="vs-dark"
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              minimap: { enabled: true },
              wordWrap: 'on',
              automaticLayout: true,
              padding: { top: 16 },
            }}
          />
        ) : (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
          }}>
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  )
}
