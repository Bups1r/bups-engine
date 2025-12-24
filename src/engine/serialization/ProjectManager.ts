import { invoke } from '@tauri-apps/api/tauri'
import { SceneSerializer, SerializedScene } from './SceneSerializer'
import { World } from '../ecs/World'

export interface ProjectMetadata {
  name: string
  version: string
  createdAt: string
  modifiedAt: string
  author?: string
  description?: string
  engineVersion: string
}

export interface ProjectFile {
  metadata: ProjectMetadata
  scenes: string[] // List of scene file paths relative to project
  activeScene: string | null
  settings: ProjectSettings
}

export interface ProjectSettings {
  renderSettings: {
    shadows: boolean
    antialias: boolean
    pixelRatio: number
  }
  physicsSettings: {
    gravity: { x: number; y: number; z: number }
    fixedTimeStep: number
  }
  audioSettings: {
    masterVolume: number
  }
}

export interface AutoSaveConfig {
  enabled: boolean
  intervalMs: number
  maxBackups: number
}

export class ProjectManager {
  private static readonly PROJECT_FILE_NAME = 'project.bups'
  private static readonly SCENE_EXTENSION = '.scene.json'
  private static readonly ENGINE_VERSION = '0.1.0'
  private static readonly DEFAULT_SETTINGS: ProjectSettings = {
    renderSettings: {
      shadows: true,
      antialias: true,
      pixelRatio: 1
    },
    physicsSettings: {
      gravity: { x: 0, y: -9.81, z: 0 },
      fixedTimeStep: 1 / 60
    },
    audioSettings: {
      masterVolume: 1
    }
  }

  private projectPath: string | null = null
  private projectData: ProjectFile | null = null
  private isDirty: boolean = false
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null
  private autoSaveConfig: AutoSaveConfig = {
    enabled: true,
    intervalMs: 60000, // 1 minute
    maxBackups: 5
  }
  private lastSaveTime: number = 0
  private onDirtyChange?: (isDirty: boolean) => void
  private onAutoSave?: () => void

  /**
   * Create a new project at the specified path
   */
  async createProject(projectPath: string, projectName: string): Promise<ProjectFile> {
    this.projectPath = projectPath

    const now = new Date().toISOString()
    this.projectData = {
      metadata: {
        name: projectName,
        version: '1.0.0',
        createdAt: now,
        modifiedAt: now,
        engineVersion: ProjectManager.ENGINE_VERSION
      },
      scenes: [],
      activeScene: null,
      settings: { ...ProjectManager.DEFAULT_SETTINGS }
    }

    // Create project directory structure
    await this.createProjectStructure(projectPath)

    // Save project file
    await this.saveProjectFile()

    // Create default scene
    const defaultScenePath = await this.createDefaultScene(projectPath)
    this.projectData.scenes.push(defaultScenePath)
    this.projectData.activeScene = defaultScenePath

    await this.saveProjectFile()

    this.startAutoSave()
    return this.projectData
  }

  /**
   * Create the standard project directory structure
   */
  private async createProjectStructure(projectPath: string): Promise<void> {
    const directories = [
      `${projectPath}/scenes`,
      `${projectPath}/assets`,
      `${projectPath}/assets/models`,
      `${projectPath}/assets/textures`,
      `${projectPath}/assets/audio`,
      `${projectPath}/scripts`
    ]

    for (const dir of directories) {
      await invoke('create_directory', { path: dir })
    }
  }

  /**
   * Create a default empty scene
   */
  private async createDefaultScene(projectPath: string): Promise<string> {
    const scenePath = `scenes/main${ProjectManager.SCENE_EXTENSION}`
    const fullPath = `${projectPath}/${scenePath}`

    const defaultScene: SerializedScene = {
      version: '1.0.0',
      name: 'Main Scene',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      entities: []
    }

    await invoke('write_file', {
      path: fullPath,
      content: JSON.stringify(defaultScene, null, 2)
    })

    return scenePath
  }

  /**
   * Open an existing project
   */
  async openProject(projectPath: string): Promise<ProjectFile> {
    this.projectPath = projectPath
    const projectFilePath = `${projectPath}/${ProjectManager.PROJECT_FILE_NAME}`

    try {
      const content = await invoke<string>('read_file', { path: projectFilePath })
      this.projectData = JSON.parse(content) as ProjectFile

      // Migrate if needed
      this.migrateProject()

      this.isDirty = false
      this.startAutoSave()

      return this.projectData
    } catch (error) {
      throw new Error(`Failed to open project: ${error}`)
    }
  }

  /**
   * Migrate older project formats to current version
   */
  private migrateProject(): void {
    if (!this.projectData) return

    // Add any missing settings with defaults
    if (!this.projectData.settings) {
      this.projectData.settings = { ...ProjectManager.DEFAULT_SETTINGS }
      this.isDirty = true
    }

    // Ensure all setting categories exist
    if (!this.projectData.settings.renderSettings) {
      this.projectData.settings.renderSettings = ProjectManager.DEFAULT_SETTINGS.renderSettings
      this.isDirty = true
    }
    if (!this.projectData.settings.physicsSettings) {
      this.projectData.settings.physicsSettings = ProjectManager.DEFAULT_SETTINGS.physicsSettings
      this.isDirty = true
    }
    if (!this.projectData.settings.audioSettings) {
      this.projectData.settings.audioSettings = ProjectManager.DEFAULT_SETTINGS.audioSettings
      this.isDirty = true
    }
  }

  /**
   * Save the project file
   */
  async saveProjectFile(): Promise<void> {
    if (!this.projectPath || !this.projectData) {
      throw new Error('No project loaded')
    }

    this.projectData.metadata.modifiedAt = new Date().toISOString()

    const projectFilePath = `${this.projectPath}/${ProjectManager.PROJECT_FILE_NAME}`
    await invoke('write_file', {
      path: projectFilePath,
      content: JSON.stringify(this.projectData, null, 2)
    })

    this.isDirty = false
    this.lastSaveTime = Date.now()
    this.onDirtyChange?.(false)
  }

  /**
   * Save a scene to a file
   */
  async saveScene(world: World, scenePath?: string): Promise<string> {
    if (!this.projectPath) {
      throw new Error('No project loaded')
    }

    const sceneData = SceneSerializer.serializeWorld(world)
    const relativePath = scenePath || `scenes/${world.name.toLowerCase().replace(/\s+/g, '_')}${ProjectManager.SCENE_EXTENSION}`
    const fullPath = `${this.projectPath}/${relativePath}`

    // Update modification time
    sceneData.modifiedAt = new Date().toISOString()

    await invoke('write_file', {
      path: fullPath,
      content: JSON.stringify(sceneData, null, 2)
    })

    // Add to project scenes if not already present
    if (this.projectData && !this.projectData.scenes.includes(relativePath)) {
      this.projectData.scenes.push(relativePath)
      this.markDirty()
    }

    this.lastSaveTime = Date.now()
    return relativePath
  }

  /**
   * Load a scene from a file into a World
   */
  async loadScene(world: World, scenePath: string): Promise<void> {
    if (!this.projectPath) {
      throw new Error('No project loaded')
    }

    const fullPath = `${this.projectPath}/${scenePath}`

    try {
      const content = await invoke<string>('read_file', { path: fullPath })
      const sceneData = JSON.parse(content) as SerializedScene

      if (!SceneSerializer.validateSceneData(sceneData)) {
        throw new Error('Invalid scene data format')
      }

      SceneSerializer.deserializeScene(world, sceneData)

      // Update active scene
      if (this.projectData) {
        this.projectData.activeScene = scenePath
        this.markDirty()
      }
    } catch (error) {
      throw new Error(`Failed to load scene: ${error}`)
    }
  }

  /**
   * Create a new scene
   */
  async createScene(name: string): Promise<string> {
    if (!this.projectPath) {
      throw new Error('No project loaded')
    }

    const scenePath = `scenes/${name.toLowerCase().replace(/\s+/g, '_')}${ProjectManager.SCENE_EXTENSION}`
    const fullPath = `${this.projectPath}/${scenePath}`

    // Check if scene already exists
    const exists = await invoke<boolean>('file_exists', { path: fullPath })
    if (exists) {
      throw new Error(`Scene already exists: ${name}`)
    }

    const sceneData: SerializedScene = {
      version: '1.0.0',
      name,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      entities: []
    }

    await invoke('write_file', {
      path: fullPath,
      content: JSON.stringify(sceneData, null, 2)
    })

    if (this.projectData) {
      this.projectData.scenes.push(scenePath)
      this.markDirty()
    }

    return scenePath
  }

  /**
   * Delete a scene
   */
  async deleteScene(scenePath: string): Promise<void> {
    if (!this.projectPath || !this.projectData) {
      throw new Error('No project loaded')
    }

    // Remove from project
    const index = this.projectData.scenes.indexOf(scenePath)
    if (index !== -1) {
      this.projectData.scenes.splice(index, 1)
    }

    // If this was the active scene, clear it
    if (this.projectData.activeScene === scenePath) {
      this.projectData.activeScene = this.projectData.scenes[0] || null
    }

    // Note: We don't actually delete the file, just remove it from the project
    // This is safer and allows for recovery

    this.markDirty()
  }

  /**
   * Get list of scenes in the project
   */
  getScenes(): string[] {
    return this.projectData?.scenes || []
  }

  /**
   * Get the active scene path
   */
  getActiveScene(): string | null {
    return this.projectData?.activeScene || null
  }

  /**
   * Set the active scene
   */
  setActiveScene(scenePath: string): void {
    if (this.projectData && this.projectData.scenes.includes(scenePath)) {
      this.projectData.activeScene = scenePath
      this.markDirty()
    }
  }

  /**
   * Get project metadata
   */
  getMetadata(): ProjectMetadata | null {
    return this.projectData?.metadata || null
  }

  /**
   * Update project metadata
   */
  updateMetadata(updates: Partial<ProjectMetadata>): void {
    if (this.projectData) {
      this.projectData.metadata = { ...this.projectData.metadata, ...updates }
      this.markDirty()
    }
  }

  /**
   * Get project settings
   */
  getSettings(): ProjectSettings | null {
    return this.projectData?.settings || null
  }

  /**
   * Update project settings
   */
  updateSettings(updates: Partial<ProjectSettings>): void {
    if (this.projectData) {
      this.projectData.settings = { ...this.projectData.settings, ...updates }
      this.markDirty()
    }
  }

  /**
   * Get the current project path
   */
  getProjectPath(): string | null {
    return this.projectPath
  }

  /**
   * Check if there are unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.isDirty
  }

  /**
   * Mark the project as dirty (has unsaved changes)
   */
  markDirty(): void {
    if (!this.isDirty) {
      this.isDirty = true
      this.onDirtyChange?.(true)
    }
  }

  /**
   * Set callback for dirty state changes
   */
  setOnDirtyChange(callback: (isDirty: boolean) => void): void {
    this.onDirtyChange = callback
  }

  /**
   * Set callback for auto-save events
   */
  setOnAutoSave(callback: () => void): void {
    this.onAutoSave = callback
  }

  /**
   * Configure auto-save behavior
   */
  configureAutoSave(config: Partial<AutoSaveConfig>): void {
    this.autoSaveConfig = { ...this.autoSaveConfig, ...config }

    // Restart auto-save with new config
    this.stopAutoSave()
    if (this.autoSaveConfig.enabled && this.projectPath) {
      this.startAutoSave()
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (!this.autoSaveConfig.enabled || this.autoSaveTimer) {
      return
    }

    this.autoSaveTimer = setInterval(async () => {
      if (this.isDirty) {
        try {
          await this.saveProjectFile()
          this.onAutoSave?.()
          console.log('[ProjectManager] Auto-saved project')
        } catch (error) {
          console.error('[ProjectManager] Auto-save failed:', error)
        }
      }
    }, this.autoSaveConfig.intervalMs)
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
      this.autoSaveTimer = null
    }
  }

  /**
   * Create a backup of the current scene
   */
  async createBackup(world: World): Promise<string> {
    if (!this.projectPath) {
      throw new Error('No project loaded')
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `${this.projectPath}/backups`

    // Ensure backup directory exists
    await invoke('create_directory', { path: backupPath })

    const sceneData = SceneSerializer.serializeWorld(world)
    const backupFile = `${backupPath}/${world.name}_${timestamp}.backup.json`

    await invoke('write_file', {
      path: backupFile,
      content: JSON.stringify(sceneData, null, 2)
    })

    // Clean up old backups
    await this.cleanupBackups()

    return backupFile
  }

  /**
   * Clean up old backups beyond the max limit
   */
  private async cleanupBackups(): Promise<void> {
    if (!this.projectPath) return

    try {
      const backupPath = `${this.projectPath}/backups`
      const files = await invoke<string[]>('list_directory', { path: backupPath })

      // Filter to only backup files and sort by name (which includes timestamp)
      const backupFiles = files
        .filter(f => f.endsWith('.backup.json'))
        .sort()
        .reverse()

      // Remove excess backups (keeping newest ones)
      // Note: We don't actually delete files in this implementation
      // A full implementation would use a delete_file Tauri command
      if (backupFiles.length > this.autoSaveConfig.maxBackups) {
        console.log(`[ProjectManager] ${backupFiles.length - this.autoSaveConfig.maxBackups} old backups can be cleaned up`)
      }
    } catch (error) {
      // Backup directory might not exist yet
      console.log('[ProjectManager] No backups to clean up')
    }
  }

  /**
   * Get time since last save in milliseconds
   */
  getTimeSinceLastSave(): number {
    if (this.lastSaveTime === 0) return 0
    return Date.now() - this.lastSaveTime
  }

  /**
   * Close the current project
   */
  async closeProject(): Promise<void> {
    this.stopAutoSave()
    this.projectPath = null
    this.projectData = null
    this.isDirty = false
    this.lastSaveTime = 0
  }

  /**
   * Check if a project is currently loaded
   */
  isProjectLoaded(): boolean {
    return this.projectPath !== null && this.projectData !== null
  }

  /**
   * Export scene to a standalone JSON file
   */
  async exportScene(world: World, exportPath: string): Promise<void> {
    const sceneData = SceneSerializer.serializeWorld(world)

    await invoke('write_file', {
      path: exportPath,
      content: JSON.stringify(sceneData, null, 2)
    })
  }

  /**
   * Import a scene from a standalone JSON file
   */
  async importScene(world: World, importPath: string): Promise<void> {
    const content = await invoke<string>('read_file', { path: importPath })
    const sceneData = JSON.parse(content) as SerializedScene

    if (!SceneSerializer.validateSceneData(sceneData)) {
      throw new Error('Invalid scene data format')
    }

    SceneSerializer.deserializeScene(world, sceneData)
  }
}

// Singleton instance for global access
export const projectManager = new ProjectManager()
