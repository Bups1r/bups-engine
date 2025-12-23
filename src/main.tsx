import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// Global error handlers to catch any uncaught errors
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global error:', { message, source, lineno, colno, error })
  const errorDiv = document.createElement('div')
  errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:white;padding:16px;z-index:99999;font-family:monospace;'
  errorDiv.innerHTML = `<strong>Error:</strong> ${message}<br><small>${source}:${lineno}:${colno}</small>`
  document.body.prepend(errorDiv)
  return false
}

window.onunhandledrejection = (event) => {
  console.error('Unhandled promise rejection:', event.reason)
  const errorDiv = document.createElement('div')
  errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:white;padding:16px;z-index:99999;font-family:monospace;'
  errorDiv.innerHTML = `<strong>Promise Error:</strong> ${event.reason}`
  document.body.prepend(errorDiv)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
