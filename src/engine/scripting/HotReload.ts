import { ScriptComponent } from './ScriptComponent'
import { World } from '../ecs/World'

export interface HotReloadConfig {
  pollInterval?: number // Interval in ms to check for file changes (default: 1000)
  enabled?: boolean // Enable/disable hot reload (default: true)
}

export interface FileWatchEntry {
  scriptName: string
  lastModified: number
  lastContent: string
  component: ScriptComponent
}

export type HotReloadStatus = 'idle' | 'watching' | 'reloading' | 'error'

export interface HotReloadEvent {
  type: 'reload-start' | 'reload-success' | 'reload-error'
  scriptName: string
  timestamp: number
  error?: string
}

/**
 * HotReload - Watches for file changes and automatically reloads scripts
 * without restarting the engine, preserving entity state.
 *
 * Features:
 * - Polling-based file watching
 * - Automatic script recompilation
 * - State preservation during reload
 * - Event notifications for UI updates
 */
export class HotReload {
  private static instance: HotReload | null = null
  private world: World | null = null
  private config: Required<HotReloadConfig>
  private watchedScripts: Map<string, FileWatchEntry> = new Map()
  private pollInterval: number | null = null
  private status: HotReloadStatus = 'idle'
  private listeners: ((event: HotReloadEvent) => void)[] = []
  private lastReloadTime: number = 0
  private scriptsDirectory: string = 'scripts/'

  private constructor(config: HotReloadConfig = {}) {
    this.config = {
      pollInterval: config.pollInterval ?? 1000,
      enabled: config.enabled ?? true
    }
  }

  /**
   * Get the singleton instance of HotReload
   */
  static getInstance(config?: HotReloadConfig): HotReload {
    if (!HotReload.instance) {
      HotReload.instance = new HotReload(config)
    }
    return HotReload.instance
  }

  /**
   * Initialize hot reload with a world instance
   */
  initialize(world: World): void {
    this.world = world
    if (this.config.enabled) {
      this.start()
    }
  }

  /**
   * Start watching for file changes
   */
  start(): void {
    if (this.status === 'watching') {
      console.warn('[HotReload] Already watching')
      return
    }

    if (!this.world) {
      console.error('[HotReload] Cannot start: world not initialized')
      return
    }

    this.status = 'watching'
    this.pollInterval = window.setInterval(() => {
      this.checkForChanges()
    }, this.config.pollInterval)

    console.log('[HotReload] Started watching scripts')
  }

  /**
   * Stop watching for file changes
   */
  stop(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    this.status = 'idle'
    console.log('[HotReload] Stopped watching')
  }

  /**
   * Register a script component for hot reload
   */
  watch(scriptName: string, component: ScriptComponent): void {
    if (!this.watchedScripts.has(scriptName)) {
      this.watchedScripts.set(scriptName, {
        scriptName,
        lastModified: Date.now(),
        lastContent: component.sourceCode,
        component
      })
      console.log(`[HotReload] Watching script: ${scriptName}`)
    }
  }

  /**
   * Unregister a script component from hot reload
   */
  unwatch(scriptName: string): void {
    if (this.watchedScripts.delete(scriptName)) {
      console.log(`[HotReload] Stopped watching script: ${scriptName}`)
    }
  }

  /**
   * Manually reload a specific script
   */
  async reloadScript(scriptName: string, newCode: string): Promise<boolean> {
    const entry = this.watchedScripts.get(scriptName)
    if (!entry) {
      console.warn(`[HotReload] Script not watched: ${scriptName}`)
      return false
    }

    // Check if content actually changed
    if (entry.lastContent === newCode) {
      console.log(`[HotReload] No changes detected in ${scriptName}`)
      return true
    }

    this.status = 'reloading'
    this.lastReloadTime = Date.now()

    this.emitEvent({
      type: 'reload-start',
      scriptName,
      timestamp: this.lastReloadTime
    })

    try {
      // Save current state (variables) before reload
      const savedState = { ...entry.component.variables }

      // Update source code and recompile
      entry.component.setSourceCode(newCode)

      // Check for compilation errors
      const error = entry.component.getError()
      if (error) {
        throw new Error(`Compilation failed: ${error}`)
      }

      // Restore saved state
      entry.component.variables = { ...savedState }

      // Update watch entry
      entry.lastModified = Date.now()
      entry.lastContent = newCode

      this.status = 'watching'

      this.emitEvent({
        type: 'reload-success',
        scriptName,
        timestamp: Date.now()
      })

      console.log(`[HotReload] Successfully reloaded script: ${scriptName}`)
      return true
    } catch (error) {
      this.status = 'error'

      const errorMessage = error instanceof Error ? error.message : String(error)

      this.emitEvent({
        type: 'reload-error',
        scriptName,
        timestamp: Date.now(),
        error: errorMessage
      })

      console.error(`[HotReload] Failed to reload script ${scriptName}:`, errorMessage)

      // Revert status back to watching
      setTimeout(() => {
        if (this.status === 'error') {
          this.status = 'watching'
        }
      }, 2000)

      return false
    }
  }

  /**
   * Reload all scripts with a specific name across all entities
   */
  async reloadAllScripts(scriptName: string, newCode: string): Promise<void> {
    if (!this.world) {
      console.error('[HotReload] World not initialized')
      return
    }

    // Find all entities with ScriptComponent that match the script name
    const entities = this.world.getEntities()
    const reloadPromises: Promise<boolean>[] = []

    for (const entity of entities) {
      const scripts = entity.getAllComponents().filter(
        c => c instanceof ScriptComponent && c.scriptName === scriptName
      ) as ScriptComponent[]

      for (const script of scripts) {
        // Register for watching if not already watched
        if (!this.watchedScripts.has(scriptName)) {
          this.watch(scriptName, script)
        }

        // Queue reload
        reloadPromises.push(this.reloadScript(scriptName, newCode))
      }
    }

    await Promise.all(reloadPromises)
  }

  /**
   * Check for file changes (in a real implementation, this would check filesystem)
   * For now, this is a placeholder that can be triggered manually or via external sources
   */
  private checkForChanges(): void {
    // In a browser environment, we can't directly access the filesystem
    // This method would be called by external file watching logic (e.g., Tauri backend)
    // or by manual triggers from the editor

    // For now, this is a no-op placeholder
    // The actual reload happens via reloadScript() or reloadAllScripts()
  }

  /**
   * Add an event listener for hot reload events
   */
  addEventListener(listener: (event: HotReloadEvent) => void): void {
    this.listeners.push(listener)
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: (event: HotReloadEvent) => void): void {
    const index = this.listeners.indexOf(listener)
    if (index !== -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * Emit a hot reload event to all listeners
   */
  private emitEvent(event: HotReloadEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('[HotReload] Error in event listener:', error)
      }
    }
  }

  /**
   * Get current status
   */
  getStatus(): HotReloadStatus {
    return this.status
  }

  /**
   * Get last reload time
   */
  getLastReloadTime(): number {
    return this.lastReloadTime
  }

  /**
   * Get list of watched scripts
   */
  getWatchedScripts(): string[] {
    return Array.from(this.watchedScripts.keys())
  }

  /**
   * Check if a script is being watched
   */
  isWatching(scriptName: string): boolean {
    return this.watchedScripts.has(scriptName)
  }

  /**
   * Enable hot reload
   */
  enable(): void {
    this.config.enabled = true
    if (this.status === 'idle' && this.world) {
      this.start()
    }
  }

  /**
   * Disable hot reload
   */
  disable(): void {
    this.config.enabled = false
    if (this.status === 'watching') {
      this.stop()
    }
  }

  /**
   * Check if hot reload is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Set the scripts directory path
   */
  setScriptsDirectory(path: string): void {
    this.scriptsDirectory = path
  }

  /**
   * Get the scripts directory path
   */
  getScriptsDirectory(): string {
    return this.scriptsDirectory
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop()
    this.watchedScripts.clear()
    this.listeners = []
    this.world = null
  }
}

/**
 * Helper function to get the singleton instance
 */
export function getHotReload(config?: HotReloadConfig): HotReload {
  return HotReload.getInstance(config)
}
