import { useState } from 'react'
import { useEngineStore } from '../stores/engineStore'
import { useProjectStore } from '../stores/projectStore'
import { Exporter, ExportConfig, ExportProgress } from '../engine/export/Exporter'

interface ExportDialogProps {
  onClose: () => void
}

export default function ExportDialog({ onClose }: ExportDialogProps) {
  const engine = useEngineStore((s) => s.engine)
  const projectName = useProjectStore((s) => s.projectName)

  const [gameName, setGameName] = useState(projectName || 'My Game')
  const [platform, setPlatform] = useState<'html5' | 'windows' | 'mac' | 'linux'>('html5')
  const [outputPath, setOutputPath] = useState('')
  const [icon, setIcon] = useState('')
  const [includeAssets, setIncludeAssets] = useState(true)
  const [minify, setMinify] = useState(false)

  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSelectOutputPath = async () => {
    try {
      const { open } = await import('@tauri-apps/api/dialog')
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Output Directory'
      })

      if (selected && typeof selected === 'string') {
        setOutputPath(selected)
      }
    } catch (err) {
      console.error('Failed to open directory picker:', err)
      setError('Failed to open directory picker')
    }
  }

  const handleSelectIcon = async () => {
    try {
      const { open } = await import('@tauri-apps/api/dialog')
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Image',
          extensions: ['png', 'jpg', 'jpeg', 'ico']
        }],
        title: 'Select Game Icon'
      })

      if (selected && typeof selected === 'string') {
        setIcon(selected)
      }
    } catch (err) {
      console.error('Failed to open file picker:', err)
      setError('Failed to open file picker')
    }
  }

  const handleExport = async () => {
    if (!engine) {
      setError('Engine not initialized')
      return
    }

    // Validate inputs
    if (!gameName.trim()) {
      setError('Please enter a game name')
      return
    }

    if (!outputPath.trim()) {
      setError('Please select an output directory')
      return
    }

    setIsExporting(true)
    setError(null)
    setSuccess(false)
    setProgress(null)

    try {
      const exporter = new Exporter(engine)

      const config: ExportConfig = {
        gameName: gameName.trim(),
        outputPath: outputPath.trim(),
        icon: icon.trim() || undefined,
        platform,
        includeAssets,
        minify
      }

      // Validate config
      const validation = exporter.validateConfig(config)
      if (!validation.valid) {
        setError(validation.errors.join(', '))
        setIsExporting(false)
        return
      }

      // Export based on platform
      if (platform === 'html5') {
        await exporter.exportHTML5(config, (p) => {
          setProgress(p)
        })
        setSuccess(true)
      } else {
        await exporter.exportDesktop(config, (p) => {
          setProgress(p)
        })
        setSuccess(true)
      }
    } catch (err) {
      console.error('Export error:', err)
      setError(err instanceof Error ? err.message : 'Export failed')
      setSuccess(false)
    } finally {
      setIsExporting(false)
    }
  }

  const getOS = () => {
    const platform = navigator.platform.toLowerCase()
    if (platform.includes('win')) return 'windows'
    if (platform.includes('mac')) return 'mac'
    if (platform.includes('linux')) return 'linux'
    return 'html5'
  }

  const currentOS = getOS()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export Game</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Game Name */}
          <div className="form-group">
            <label>Game Name *</label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="My Awesome Game"
              disabled={isExporting}
            />
          </div>

          {/* Platform Selection */}
          <div className="form-group">
            <label>Platform *</label>
            <div className="platform-grid">
              <button
                className={`platform-btn ${platform === 'html5' ? 'active' : ''}`}
                onClick={() => setPlatform('html5')}
                disabled={isExporting}
              >
                <div className="platform-icon">🌐</div>
                <div className="platform-label">HTML5</div>
                <div className="platform-desc">Web Browser</div>
              </button>

              <button
                className={`platform-btn ${platform === 'windows' ? 'active' : ''} ${currentOS !== 'windows' ? 'disabled' : ''}`}
                onClick={() => setPlatform('windows')}
                disabled={isExporting || currentOS !== 'windows'}
                title={currentOS !== 'windows' ? 'Only available on Windows' : ''}
              >
                <div className="platform-icon">💻</div>
                <div className="platform-label">Windows</div>
                <div className="platform-desc">.exe</div>
              </button>

              <button
                className={`platform-btn ${platform === 'mac' ? 'active' : ''} ${currentOS !== 'mac' ? 'disabled' : ''}`}
                onClick={() => setPlatform('mac')}
                disabled={isExporting || currentOS !== 'mac'}
                title={currentOS !== 'mac' ? 'Only available on macOS' : ''}
              >
                <div className="platform-icon">🍎</div>
                <div className="platform-label">macOS</div>
                <div className="platform-desc">.app</div>
              </button>

              <button
                className={`platform-btn ${platform === 'linux' ? 'active' : ''} ${currentOS !== 'linux' ? 'disabled' : ''}`}
                onClick={() => setPlatform('linux')}
                disabled={isExporting || currentOS !== 'linux'}
                title={currentOS !== 'linux' ? 'Only available on Linux' : ''}
              >
                <div className="platform-icon">🐧</div>
                <div className="platform-label">Linux</div>
                <div className="platform-desc">.AppImage</div>
              </button>
            </div>
          </div>

          {/* Output Path */}
          <div className="form-group">
            <label>Output Directory *</label>
            <div className="path-input">
              <input
                type="text"
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                placeholder="Select output directory..."
                disabled={isExporting}
              />
              <button onClick={handleSelectOutputPath} disabled={isExporting}>
                Browse
              </button>
            </div>
          </div>

          {/* Icon (Optional) */}
          <div className="form-group">
            <label>Game Icon (Optional)</label>
            <div className="path-input">
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="Select icon file..."
                disabled={isExporting}
              />
              <button onClick={handleSelectIcon} disabled={isExporting}>
                Browse
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="form-group">
            <label>Options</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeAssets}
                  onChange={(e) => setIncludeAssets(e.target.checked)}
                  disabled={isExporting}
                />
                Include all assets
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={minify}
                  onChange={(e) => setMinify(e.target.checked)}
                  disabled={isExporting}
                />
                Minify output
              </label>
            </div>
          </div>

          {/* Progress */}
          {progress && (
            <div className="progress-section">
              <div className="progress-header">
                <span>{progress.message}</span>
                <span>{progress.progress}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="error-message">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="success-message">
              Export completed successfully! Check the output directory.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isExporting}>
            {success ? 'Close' : 'Cancel'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={isExporting || success}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow: auto;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }

        .export-dialog {
          max-width: 700px;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid var(--border-color);
        }

        .modal-header h2 {
          margin: 0;
          font-size: 20px;
          color: var(--text-primary);
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 28px;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.15s ease;
        }

        .close-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .modal-body {
          padding: 20px;
          max-height: calc(90vh - 140px);
          overflow-y: auto;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-group input[type="text"] {
          width: 100%;
          padding: 10px 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-primary);
          font-size: 14px;
          font-family: inherit;
        }

        .form-group input[type="text"]:focus {
          outline: none;
          border-color: var(--accent);
        }

        .form-group input[type="text"]:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .platform-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
        }

        .platform-btn {
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
        }

        .platform-btn:hover:not(:disabled):not(.disabled) {
          border-color: var(--accent);
          background: var(--bg-tertiary);
        }

        .platform-btn.active {
          border-color: var(--accent);
          background: var(--accent);
        }

        .platform-btn.active .platform-label,
        .platform-btn.active .platform-desc {
          color: white;
        }

        .platform-btn:disabled,
        .platform-btn.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .platform-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .platform-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .platform-desc {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .path-input {
          display: flex;
          gap: 8px;
        }

        .path-input input {
          flex: 1;
        }

        .path-input button {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 10px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .path-input button:hover:not(:disabled) {
          background: var(--accent);
          border-color: var(--accent);
        }

        .path-input button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--text-primary);
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"]:disabled {
          cursor: not-allowed;
        }

        .progress-section {
          margin-top: 20px;
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 6px;
          border: 1px solid var(--border-color);
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--accent);
          transition: width 0.3s ease;
        }

        .error-message {
          margin-top: 16px;
          padding: 12px;
          background: rgba(220, 38, 38, 0.1);
          border: 1px solid rgba(220, 38, 38, 0.3);
          border-radius: 6px;
          color: #fca5a5;
          font-size: 14px;
        }

        .success-message {
          margin-top: 16px;
          padding: 12px;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 6px;
          color: #86efac;
          font-size: 14px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px;
          border-top: 1px solid var(--border-color);
        }

        .btn {
          padding: 10px 20px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          border: none;
        }

        .btn-secondary {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--bg-secondary);
        }

        .btn-primary {
          background: var(--accent);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
