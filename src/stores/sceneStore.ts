import { create } from 'zustand'
import { projectManager } from '../engine'
import { Engine } from '../engine/Engine'

interface SceneState {
  // Current scene state
  currentScenePath: string | null
  currentSceneName: string
  isDirty: boolean
  lastSaveTime: number | null

  // Auto-save state
  autoSaveEnabled: boolean
  autoSaveInterval: number // in milliseconds

  // Project state
  isProjectLoaded: boolean
  projectPath: string | null
  projectName: string
  availableScenes: string[]

  // Loading/saving state
  isSaving: boolean
  isLoading: boolean
  error: string | null

  // Actions
  setCurrentScene: (path: string | null, name: string) => void
  markDirty: () => void
  markClean: () => void

  // Project actions
  createProject: (path: string, name: string) => Promise<void>
  openProject: (path: string) => Promise<void>
  closeProject: () => Promise<void>

  // Scene actions
  saveScene: (engine: Engine, scenePath?: string) => Promise<void>
  loadScene: (engine: Engine, scenePath: string) => Promise<void>
  createScene: (name: string) => Promise<string>
  deleteScene: (scenePath: string) => Promise<void>

  // Auto-save actions
  setAutoSaveEnabled: (enabled: boolean) => void
  setAutoSaveInterval: (interval: number) => void

  // Utility
  clearError: () => void
  refreshSceneList: () => void
}

export const useSceneStore = create<SceneState>((set, get) => ({
  // Initial state
  currentScenePath: null,
  currentSceneName: 'Untitled Scene',
  isDirty: false,
  lastSaveTime: null,

  autoSaveEnabled: true,
  autoSaveInterval: 60000, // 1 minute

  isProjectLoaded: false,
  projectPath: null,
  projectName: 'New Project',
  availableScenes: [],

  isSaving: false,
  isLoading: false,
  error: null,

  // Basic setters
  setCurrentScene: (path, name) => set({
    currentScenePath: path,
    currentSceneName: name
  }),

  markDirty: () => {
    set({ isDirty: true })
    projectManager.markDirty()
  },

  markClean: () => set({
    isDirty: false,
    lastSaveTime: Date.now()
  }),

  // Project actions
  createProject: async (path, name) => {
    set({ isLoading: true, error: null })
    try {
      const projectData = await projectManager.createProject(path, name)

      // Configure auto-save
      const { autoSaveEnabled, autoSaveInterval } = get()
      projectManager.configureAutoSave({
        enabled: autoSaveEnabled,
        intervalMs: autoSaveInterval
      })

      // Set up dirty change callback
      projectManager.setOnDirtyChange((isDirty) => {
        set({ isDirty })
      })

      // Set up auto-save callback
      projectManager.setOnAutoSave(() => {
        set({ lastSaveTime: Date.now() })
        console.log('[SceneStore] Auto-saved')
      })

      set({
        isProjectLoaded: true,
        projectPath: path,
        projectName: name,
        availableScenes: projectData.scenes,
        currentScenePath: projectData.activeScene,
        currentSceneName: 'Main Scene',
        isDirty: false,
        isLoading: false
      })
    } catch (error) {
      set({
        error: `Failed to create project: ${error}`,
        isLoading: false
      })
      throw error
    }
  },

  openProject: async (path) => {
    set({ isLoading: true, error: null })
    try {
      const projectData = await projectManager.openProject(path)

      // Configure auto-save
      const { autoSaveEnabled, autoSaveInterval } = get()
      projectManager.configureAutoSave({
        enabled: autoSaveEnabled,
        intervalMs: autoSaveInterval
      })

      // Set up dirty change callback
      projectManager.setOnDirtyChange((isDirty) => {
        set({ isDirty })
      })

      // Set up auto-save callback
      projectManager.setOnAutoSave(() => {
        set({ lastSaveTime: Date.now() })
        console.log('[SceneStore] Auto-saved')
      })

      set({
        isProjectLoaded: true,
        projectPath: path,
        projectName: projectData.metadata.name,
        availableScenes: projectData.scenes,
        currentScenePath: projectData.activeScene,
        isDirty: false,
        isLoading: false
      })
    } catch (error) {
      set({
        error: `Failed to open project: ${error}`,
        isLoading: false
      })
      throw error
    }
  },

  closeProject: async () => {
    const { isDirty } = get()

    if (isDirty) {
      // In a real app, you'd prompt the user to save first
      console.warn('[SceneStore] Closing project with unsaved changes')
    }

    await projectManager.closeProject()

    set({
      isProjectLoaded: false,
      projectPath: null,
      projectName: 'New Project',
      availableScenes: [],
      currentScenePath: null,
      currentSceneName: 'Untitled Scene',
      isDirty: false,
      lastSaveTime: null
    })
  },

  // Scene actions
  saveScene: async (engine, scenePath) => {
    set({ isSaving: true, error: null })
    try {
      const path = scenePath || get().currentScenePath

      if (projectManager.isProjectLoaded()) {
        const savedPath = await projectManager.saveScene(engine.world, path || undefined)
        set({
          currentScenePath: savedPath,
          isDirty: false,
          lastSaveTime: Date.now(),
          isSaving: false
        })

        // Refresh scene list
        get().refreshSceneList()
      } else {
        // No project loaded, just serialize to console
        const sceneData = engine.saveScene()
        console.log('[SceneStore] Scene data (no project):', sceneData)
        set({
          isDirty: false,
          lastSaveTime: Date.now(),
          isSaving: false
        })
      }
    } catch (error) {
      set({
        error: `Failed to save scene: ${error}`,
        isSaving: false
      })
      throw error
    }
  },

  loadScene: async (engine, scenePath) => {
    set({ isLoading: true, error: null })
    try {
      if (projectManager.isProjectLoaded()) {
        await projectManager.loadScene(engine.world, scenePath)

        // Extract scene name from path
        const sceneName = scenePath
          .replace(/^scenes\//, '')
          .replace(/\.scene\.json$/, '')
          .replace(/_/g, ' ')

        set({
          currentScenePath: scenePath,
          currentSceneName: sceneName,
          isDirty: false,
          isLoading: false
        })
      } else {
        set({
          error: 'No project loaded',
          isLoading: false
        })
      }
    } catch (error) {
      set({
        error: `Failed to load scene: ${error}`,
        isLoading: false
      })
      throw error
    }
  },

  createScene: async (name) => {
    set({ isLoading: true, error: null })
    try {
      const scenePath = await projectManager.createScene(name)
      get().refreshSceneList()
      set({ isLoading: false })
      return scenePath
    } catch (error) {
      set({
        error: `Failed to create scene: ${error}`,
        isLoading: false
      })
      throw error
    }
  },

  deleteScene: async (scenePath) => {
    set({ isLoading: true, error: null })
    try {
      await projectManager.deleteScene(scenePath)
      get().refreshSceneList()

      // If we deleted the current scene, clear it
      if (get().currentScenePath === scenePath) {
        const scenes = projectManager.getScenes()
        set({
          currentScenePath: scenes[0] || null,
          isLoading: false
        })
      } else {
        set({ isLoading: false })
      }
    } catch (error) {
      set({
        error: `Failed to delete scene: ${error}`,
        isLoading: false
      })
      throw error
    }
  },

  // Auto-save actions
  setAutoSaveEnabled: (enabled) => {
    set({ autoSaveEnabled: enabled })
    projectManager.configureAutoSave({ enabled })
  },

  setAutoSaveInterval: (interval) => {
    set({ autoSaveInterval: interval })
    projectManager.configureAutoSave({ intervalMs: interval })
  },

  // Utility
  clearError: () => set({ error: null }),

  refreshSceneList: () => {
    if (projectManager.isProjectLoaded()) {
      set({ availableScenes: projectManager.getScenes() })
    }
  }
}))
