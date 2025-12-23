import { create } from 'zustand'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  content?: string
}

interface ProjectState {
  projectName: string
  projectPath: string | null
  files: FileNode[]
  activeFile: string | null
  openFiles: string[]

  setProjectName: (name: string) => void
  setProjectPath: (path: string) => void
  setFiles: (files: FileNode[]) => void
  setActiveFile: (path: string | null) => void
  openFile: (path: string) => void
  closeFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectName: 'New Project',
  projectPath: null,
  files: [
    {
      name: 'src',
      path: '/src',
      type: 'folder',
      children: [
        { name: 'main.ts', path: '/src/main.ts', type: 'file', content: '// Game entry point\n\nimport { Engine } from "./engine";\n\nconst engine = new Engine();\nengine.start();' },
        { name: 'engine.ts', path: '/src/engine.ts', type: 'file', content: '// Core engine class\n\nexport class Engine {\n  start() {\n    console.log("Engine started!");\n  }\n}' },
      ]
    },
    {
      name: 'assets',
      path: '/assets',
      type: 'folder',
      children: [
        { name: 'models', path: '/assets/models', type: 'folder', children: [] },
        { name: 'textures', path: '/assets/textures', type: 'folder', children: [] },
      ]
    },
    { name: 'game.config.json', path: '/game.config.json', type: 'file', content: '{\n  "name": "My Game",\n  "version": "0.1.0"\n}' },
  ],
  activeFile: null,
  openFiles: [],

  setProjectName: (name) => set({ projectName: name }),
  setProjectPath: (path) => set({ projectPath: path }),
  setFiles: (files) => set({ files }),
  setActiveFile: (path) => set({ activeFile: path }),

  openFile: (path) => set((state) => ({
    activeFile: path,
    openFiles: state.openFiles.includes(path)
      ? state.openFiles
      : [...state.openFiles, path]
  })),

  closeFile: (path) => set((state) => {
    const newOpenFiles = state.openFiles.filter(f => f !== path)
    return {
      openFiles: newOpenFiles,
      activeFile: state.activeFile === path
        ? newOpenFiles[newOpenFiles.length - 1] || null
        : state.activeFile
    }
  }),

  updateFileContent: (path, content) => set((state) => {
    const updateNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === path) {
          return { ...node, content }
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) }
        }
        return node
      })
    }
    return { files: updateNode(state.files) }
  }),
}))
