/**
 * EXAMPLE USAGE: HotReload System
 *
 * This file demonstrates how to use the HotReload system in the Bups game engine.
 *
 * The HotReload system allows you to:
 * 1. Watch for script changes
 * 2. Automatically recompile scripts without restarting the engine
 * 3. Preserve entity state during reload
 * 4. Receive status updates for the UI
 */

import { Engine } from '../Engine'
import { ScriptComponent } from './ScriptComponent'
import { getHotReload, HotReloadEvent } from './HotReload'

// ========================================
// BASIC SETUP
// ========================================

export function setupHotReload(engine: Engine) {
  // Get the singleton instance
  const hotReload = getHotReload({
    pollInterval: 1000, // Check for changes every second
    enabled: true
  })

  // Initialize with the world
  hotReload.initialize(engine.world)

  // Add event listener for UI updates
  hotReload.addEventListener((event: HotReloadEvent) => {
    console.log(`[HotReload] ${event.type}: ${event.scriptName}`)

    switch (event.type) {
      case 'reload-start':
        // Show "Reloading..." indicator in UI
        updateUIStatus('Reloading script...')
        break
      case 'reload-success':
        // Show success message
        updateUIStatus('✓ Script reloaded successfully', 'success')
        break
      case 'reload-error':
        // Show error message
        updateUIStatus(`✗ Reload failed: ${event.error}`, 'error')
        break
    }
  })

  return hotReload
}

// ========================================
// WATCHING SCRIPTS
// ========================================

export function watchScriptComponent(scriptComponent: ScriptComponent) {
  const hotReload = getHotReload()

  // Register the script for watching
  hotReload.watch(scriptComponent.scriptName, scriptComponent)
}

export function unwatchScriptComponent(scriptComponent: ScriptComponent) {
  const hotReload = getHotReload()

  // Unregister the script
  hotReload.unwatch(scriptComponent.scriptName)
}

// ========================================
// MANUAL RELOAD
// ========================================

export async function reloadScriptFromEditor(scriptName: string, newCode: string) {
  const hotReload = getHotReload()

  // Manually trigger a reload (e.g., when user saves in the editor)
  const success = await hotReload.reloadScript(scriptName, newCode)

  if (success) {
    console.log(`Script ${scriptName} reloaded successfully`)
  } else {
    console.error(`Failed to reload script ${scriptName}`)
  }

  return success
}

// ========================================
// RELOAD ALL INSTANCES
// ========================================

export async function reloadAllInstancesOfScript(
  _engine: Engine,
  scriptName: string,
  newCode: string
) {
  const hotReload = getHotReload()

  // Reload all entities that use this script
  await hotReload.reloadAllScripts(scriptName, newCode)

  console.log(`All instances of ${scriptName} have been reloaded`)
}

// ========================================
// INTEGRATION WITH ENTITY CREATION
// ========================================

export function createEntityWithWatchedScript(
  engine: Engine,
  entityName: string,
  scriptName: string,
  scriptCode: string
) {
  const hotReload = getHotReload()

  // Create entity
  const entity = engine.createEntity(entityName)

  // Add script component
  const scriptComponent = entity.addComponent(ScriptComponent, scriptName, scriptCode)

  // Set engine reference
  scriptComponent.setEngine(engine)

  // Register for hot reload
  hotReload.watch(scriptName, scriptComponent)

  return entity
}

// ========================================
// UI STATUS UPDATES
// ========================================

function updateUIStatus(message: string, type: 'info' | 'success' | 'error' = 'info') {
  // This would integrate with your UI component
  // For example, updating a status bar or showing a toast notification
  console.log(`[UI] ${type.toUpperCase()}: ${message}`)

  // Example: Update a DOM element
  const statusElement = document.querySelector('.hot-reload-status')
  if (statusElement) {
    statusElement.textContent = message
    statusElement.className = `hot-reload-status ${type}`
  }
}

// ========================================
// REACT HOOK EXAMPLE
// ========================================

/**
 * Example React hook for hot reload status
 */
export function useHotReloadStatus() {
  const hotReload = getHotReload()

  // In a real implementation, you'd use useState and useEffect
  // to listen to hot reload events and update the UI

  return {
    status: hotReload.getStatus(),
    isEnabled: hotReload.isEnabled(),
    watchedScripts: hotReload.getWatchedScripts(),
    lastReloadTime: hotReload.getLastReloadTime()
  }
}

// ========================================
// CLEANUP
// ========================================

export function cleanupHotReload() {
  const hotReload = getHotReload()

  // Stop watching and clean up resources
  hotReload.dispose()
}

// ========================================
// FULL EXAMPLE
// ========================================

export async function fullHotReloadExample() {
  // 1. Create engine
  const canvas = document.querySelector('canvas') as HTMLCanvasElement
  const engine = new Engine({ canvas })

  // 2. Setup hot reload
  setupHotReload(engine)

  // 3. Create entity with script
  const playerScript = `
    let speed = 5.0;

    function update(ctx) {
      if (!ctx.transform) return;

      const horizontal = ctx.Input.getAxis('horizontal');
      const vertical = ctx.Input.getAxis('vertical');

      ctx.transform.translate(
        horizontal * speed * ctx.deltaTime,
        0,
        vertical * speed * ctx.deltaTime
      );
    }
  `

  createEntityWithWatchedScript(
    engine,
    'Player',
    'PlayerController',
    playerScript
  )

  // 4. Start engine
  engine.start()

  // 5. Simulate a script change (e.g., from editor)
  setTimeout(async () => {
    const updatedScript = `
      let speed = 10.0; // Changed speed!

      function update(ctx) {
        if (!ctx.transform) return;

        const horizontal = ctx.Input.getAxis('horizontal');
        const vertical = ctx.Input.getAxis('vertical');

        ctx.transform.translate(
          horizontal * speed * ctx.deltaTime,
          0,
          vertical * speed * ctx.deltaTime
        );
      }
    `

    // Reload the script - state is preserved!
    await reloadScriptFromEditor('PlayerController', updatedScript)
  }, 5000)

  // 6. Cleanup when done
  // cleanupHotReload()
}

// ========================================
// INTEGRATION WITH CODE EDITOR
// ========================================

/**
 * Example function to integrate with Monaco Editor or similar
 */
export function onEditorSave(scriptName: string, code: string) {
  const hotReload = getHotReload()

  // When user presses Ctrl+S or saves in editor
  hotReload.reloadScript(scriptName, code).then(success => {
    if (success) {
      // Show save indicator
      console.log('✓ Script saved and reloaded')
    } else {
      // Show error
      console.error('✗ Failed to reload script')
    }
  })
}

/**
 * Example function to integrate with file watcher (Tauri)
 */
export async function onFileChanged(filePath: string, fileContent: string) {
  const hotReload = getHotReload()

  // Extract script name from file path
  // e.g., "scripts/PlayerController.js" -> "PlayerController"
  const scriptName = filePath.split('/').pop()?.replace('.js', '') || ''

  // Check if this script is being watched
  if (hotReload.isWatching(scriptName)) {
    await hotReload.reloadScript(scriptName, fileContent)
  }
}
