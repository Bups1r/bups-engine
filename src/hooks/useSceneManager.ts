import { useCallback, useEffect, useRef } from 'react'
import { useSceneStore } from '../stores/sceneStore'
import { useEngineStore } from '../stores/engineStore'

export interface UseSceneManagerOptions {
  autoSaveEnabled?: boolean
  autoSaveInterval?: number
  onSceneSaved?: () => void
  onSceneLoaded?: () => void
  onError?: (error: string) => void
}

export function useSceneManager(options: UseSceneManagerOptions = {}) {
  const {
    autoSaveEnabled = true,
    autoSaveInterval = 60000,
    onSceneSaved,
    onSceneLoaded,
    onError
  } = options

  const engine = useEngineStore(state => state.engine)

  const {
    currentScenePath,
    currentSceneName,
    isDirty,
    lastSaveTime,
    isProjectLoaded,
    projectPath,
    projectName,
    availableScenes,
    isSaving,
    isLoading,
    error,
    setAutoSaveEnabled,
    setAutoSaveInterval,
    markDirty,
    saveScene: storeSaveScene,
    loadScene: storeLoadScene,
    createScene: storeCreateScene,
    deleteScene: storeDeleteScene,
    createProject: storeCreateProject,
    openProject: storeOpenProject,
    closeProject: storeCloseProject,
    clearError
  } = useSceneStore()

  // Track if we've initialized auto-save settings
  const initializedRef = useRef(false)

  // Initialize auto-save settings
  useEffect(() => {
    if (!initializedRef.current) {
      setAutoSaveEnabled(autoSaveEnabled)
      setAutoSaveInterval(autoSaveInterval)
      initializedRef.current = true
    }
  }, [autoSaveEnabled, autoSaveInterval, setAutoSaveEnabled, setAutoSaveInterval])

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error)
    }
  }, [error, onError])

  // Save the current scene
  const saveScene = useCallback(async (scenePath?: string) => {
    if (!engine) {
      console.error('[useSceneManager] No engine available')
      return
    }

    try {
      await storeSaveScene(engine, scenePath)
      onSceneSaved?.()
    } catch (err) {
      console.error('[useSceneManager] Failed to save scene:', err)
    }
  }, [engine, storeSaveScene, onSceneSaved])

  // Load a scene
  const loadScene = useCallback(async (scenePath: string) => {
    if (!engine) {
      console.error('[useSceneManager] No engine available')
      return
    }

    try {
      await storeLoadScene(engine, scenePath)
      onSceneLoaded?.()
    } catch (err) {
      console.error('[useSceneManager] Failed to load scene:', err)
    }
  }, [engine, storeLoadScene, onSceneLoaded])

  // Create a new scene
  const createScene = useCallback(async (name: string) => {
    try {
      return await storeCreateScene(name)
    } catch (err) {
      console.error('[useSceneManager] Failed to create scene:', err)
      return null
    }
  }, [storeCreateScene])

  // Delete a scene
  const deleteScene = useCallback(async (scenePath: string) => {
    try {
      await storeDeleteScene(scenePath)
    } catch (err) {
      console.error('[useSceneManager] Failed to delete scene:', err)
    }
  }, [storeDeleteScene])

  // Create a new project
  const createProject = useCallback(async (path: string, name: string) => {
    try {
      await storeCreateProject(path, name)
    } catch (err) {
      console.error('[useSceneManager] Failed to create project:', err)
    }
  }, [storeCreateProject])

  // Open an existing project
  const openProject = useCallback(async (path: string) => {
    try {
      await storeOpenProject(path)
    } catch (err) {
      console.error('[useSceneManager] Failed to open project:', err)
    }
  }, [storeOpenProject])

  // Close the current project
  const closeProject = useCallback(async () => {
    try {
      await storeCloseProject()
    } catch (err) {
      console.error('[useSceneManager] Failed to close project:', err)
    }
  }, [storeCloseProject])

  // Quick save (Ctrl+S)
  const quickSave = useCallback(() => {
    if (isDirty) {
      saveScene()
    }
  }, [isDirty, saveScene])

  // Listen for Ctrl+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        quickSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [quickSave])

  // Format time since last save
  const getTimeSinceLastSave = useCallback(() => {
    if (!lastSaveTime) return 'Never saved'

    const diff = Date.now() - lastSaveTime
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m ago`
    if (minutes > 0) return `${minutes}m ago`
    if (seconds > 0) return `${seconds}s ago`
    return 'Just now'
  }, [lastSaveTime])

  return {
    // State
    currentScenePath,
    currentSceneName,
    isDirty,
    lastSaveTime,
    isProjectLoaded,
    projectPath,
    projectName,
    availableScenes,
    isSaving,
    isLoading,
    error,

    // Actions
    saveScene,
    loadScene,
    createScene,
    deleteScene,
    createProject,
    openProject,
    closeProject,
    quickSave,
    markDirty,
    clearError,

    // Utilities
    getTimeSinceLastSave
  }
}

export default useSceneManager
