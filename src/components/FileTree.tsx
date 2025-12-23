import { useState } from 'react'
import { useProjectStore, FileNode } from '../stores/projectStore'

interface FileItemProps {
  node: FileNode
  depth: number
}

function FileItem({ node, depth }: FileItemProps) {
  const [expanded, setExpanded] = useState(true)
  const { activeFile, openFile } = useProjectStore()

  const handleClick = () => {
    if (node.type === 'folder') {
      setExpanded(!expanded)
    } else {
      openFile(node.path)
    }
  }

  const icon = node.type === 'folder'
    ? (expanded ? '📂' : '📁')
    : getFileIcon(node.name)

  return (
    <>
      <div
        className={`file-item ${activeFile === node.path ? 'active' : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
      >
        <span className="icon">{icon}</span>
        <span>{node.name}</span>
      </div>
      {node.type === 'folder' && expanded && node.children?.map((child) => (
        <FileItem key={child.path} node={child} depth={depth + 1} />
      ))}
    </>
  )
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
      return '🔷'
    case 'js':
    case 'jsx':
      return '🟨'
    case 'json':
      return '📋'
    case 'css':
      return '🎨'
    case 'html':
      return '🌐'
    case 'glb':
    case 'gltf':
      return '🎮'
    case 'png':
    case 'jpg':
    case 'jpeg':
      return '🖼️'
    default:
      return '📄'
  }
}

export default function FileTree() {
  const files = useProjectStore((s) => s.files)

  return (
    <div className="file-tree">
      {files.map((node) => (
        <FileItem key={node.path} node={node} depth={0} />
      ))}
    </div>
  )
}
