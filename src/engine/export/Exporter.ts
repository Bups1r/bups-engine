import { Engine } from '../Engine'

export interface ExportConfig {
  gameName: string
  outputPath: string
  icon?: string
  platform: 'html5' | 'windows' | 'mac' | 'linux'
  includeAssets?: boolean
  minify?: boolean
}

export interface ExportProgress {
  stage: string
  progress: number // 0-100
  message: string
}

export class Exporter {
  private engine: Engine

  constructor(engine: Engine) {
    this.engine = engine
  }

  /**
   * Export the game as HTML5 bundle
   */
  async exportHTML5(
    config: ExportConfig,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<void> {
    try {
      onProgress?.({ stage: 'init', progress: 0, message: 'Starting export...' })

      // Step 1: Save current scene
      onProgress?.({ stage: 'scene', progress: 10, message: 'Saving scene data...' })
      const sceneData = this.engine.saveScene()

      // Step 2: Collect assets
      onProgress?.({ stage: 'assets', progress: 30, message: 'Collecting assets...' })
      const assets = await this.collectAssets()

      // Step 3: Generate runtime code
      onProgress?.({ stage: 'runtime', progress: 50, message: 'Generating runtime...' })
      const runtimeCode = this.generateRuntimeCode(sceneData, assets)

      // Step 4: Generate HTML file
      onProgress?.({ stage: 'html', progress: 70, message: 'Generating HTML...' })
      const html = this.generateHTML(config, runtimeCode)

      // Step 5: Write to file
      onProgress?.({ stage: 'write', progress: 90, message: 'Writing files...' })
      await this.writeExportFiles(config.outputPath, html, config.gameName)

      onProgress?.({ stage: 'complete', progress: 100, message: 'Export complete!' })
    } catch (error) {
      console.error('Export failed:', error)
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Collect all assets used in the current scene
   */
  private async collectAssets(): Promise<Record<string, string>> {
    const assets: Record<string, string> = {}

    // TODO: Implement asset collection from AssetManager
    // For now, return empty object

    return assets
  }

  /**
   * Generate the runtime JavaScript code
   */
  private generateRuntimeCode(sceneData: object, assets: Record<string, string>): string {
    return `
// Bups Engine Runtime
(function() {
  'use strict';

  // Scene data
  const SCENE_DATA = ${JSON.stringify(sceneData, null, 2)};

  // Assets
  const ASSETS = ${JSON.stringify(assets, null, 2)};

  // Engine initialization
  function initEngine() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
      console.error('Canvas element not found');
      return;
    }

    // Simple scene renderer
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context');
      return;
    }

    // Resize canvas
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Simple game loop
    let lastTime = performance.now();
    function gameLoop(currentTime) {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Clear canvas
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render scene info
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.fillText('Bups Engine - Exported Game', 20, 40);
      ctx.fillText(\`FPS: \${Math.round(1 / deltaTime)}\`, 20, 70);
      ctx.fillText(\`Entities: \${SCENE_DATA.entities?.length || 0}\`, 20, 100);

      // Render scene entities (basic visualization)
      if (SCENE_DATA.entities && Array.isArray(SCENE_DATA.entities)) {
        ctx.fillText(\`Scene: \${SCENE_DATA.name || 'Untitled'}\`, 20, 130);

        SCENE_DATA.entities.forEach((entity, index) => {
          ctx.fillText(\`- \${entity.name || 'Entity'} (ID: \${entity.id})\`, 40, 160 + index * 30);
        });
      }

      requestAnimationFrame(gameLoop);
    }

    // Start game loop
    requestAnimationFrame(gameLoop);
  }

  // Wait for DOM to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEngine);
  } else {
    initEngine();
  }
})();
`
  }

  /**
   * Generate the HTML wrapper
   */
  private generateHTML(config: ExportConfig, runtimeCode: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(config.gameName)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #1a1a2e;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }

    #game-canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 24px;
      text-align: center;
    }

    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <canvas id="game-canvas"></canvas>
  <div id="loading">
    <div class="loading-spinner"></div>
    <div>Loading ${this.escapeHtml(config.gameName)}...</div>
  </div>

  <script>
    // Remove loading screen after a short delay
    setTimeout(() => {
      const loading = document.getElementById('loading');
      if (loading) loading.style.display = 'none';
    }, 500);
  </script>

  <script>
${runtimeCode}
  </script>
</body>
</html>
`
  }

  /**
   * Write export files to disk
   */
  private async writeExportFiles(outputPath: string, html: string, gameName: string): Promise<void> {
    // Import Tauri API
    const { invoke } = await import('@tauri-apps/api/tauri')
    const { sep } = await import('@tauri-apps/api/path')

    try {
      // Create export directory path
      const sanitizedName = gameName.replace(/[^a-zA-Z0-9-_]/g, '_')
      const exportDir = `${outputPath}${sep}${sanitizedName}_export`

      // Create output directory using our Tauri command
      await invoke('create_directory', { path: exportDir })

      // Write index.html
      const indexPath = `${exportDir}${sep}index.html`
      await invoke('write_file', { path: indexPath, content: html })

      console.log(`Exported to: ${exportDir}`)
    } catch (error) {
      console.error('Error writing files:', error)
      throw error
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * Export for desktop platforms (Windows/Mac/Linux)
   * This would use Tauri's build command
   */
  async exportDesktop(
    _config: ExportConfig,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<void> {
    onProgress?.({ stage: 'init', progress: 0, message: 'Starting desktop export...' })

    // Save scene data
    onProgress?.({ stage: 'scene', progress: 20, message: 'Saving scene data...' })
    // const sceneData = this.engine.saveScene()

    // TODO: Save scene to a file that can be loaded by the built app
    // This would require updating the Tauri app to load scene data on startup

    onProgress?.({ stage: 'build', progress: 40, message: 'Building application...' })

    // In a real implementation, this would:
    // 1. Save the current scene to the project
    // 2. Run `tauri build` command
    // 3. Copy the built executable to the output path

    // For now, we'll show a message
    throw new Error('Desktop export requires running `npm run tauri:build` from the command line')
  }

  /**
   * Validate export configuration
   */
  validateConfig(config: ExportConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.gameName || config.gameName.trim() === '') {
      errors.push('Game name is required')
    }

    if (!config.outputPath || config.outputPath.trim() === '') {
      errors.push('Output path is required')
    }

    if (!config.platform) {
      errors.push('Platform is required')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}
