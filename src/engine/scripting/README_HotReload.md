# Hot Reload System

The Hot Reload system allows you to modify script code in real-time without restarting the game engine, while preserving entity state and component data.

## Features

- **Real-time Code Updates**: Modify scripts while the engine is running
- **State Preservation**: Entity variables and state are preserved during reload
- **Error Handling**: Compilation errors are caught and reported without crashing
- **UI Integration**: Visual feedback through status indicators and toast notifications
- **Automatic Watching**: Scripts are automatically monitored for changes
- **Debounced Reloading**: Changes are batched to avoid excessive recompilation

## Architecture

### Core Components

1. **HotReload.ts** - Main hot reload manager
   - Singleton pattern for global access
   - Event-based notification system
   - Script watching and recompilation
   - State preservation during reload

2. **HotReloadStatus.tsx** - UI component for status display
   - Shows current reload status
   - Displays success/error messages
   - Counts watched scripts
   - Animated status indicators

3. **Integration Points**
   - `EngineViewport.tsx` - Initializes HotReload with the engine
   - `Editor.tsx` - Triggers reload on file changes
   - `App.tsx` - Displays status in title bar

## How It Works

### 1. Initialization

The HotReload system is initialized when the engine starts:

```typescript
import { getHotReload } from '../engine/scripting/HotReload'

const hotReload = getHotReload({
  pollInterval: 1000,  // Check every second
  enabled: true
})

hotReload.initialize(engine.world)
```

### 2. Watching Scripts

Scripts are registered for hot reload when they're created:

```typescript
import { ScriptComponent } from '../engine/scripting/ScriptComponent'

// Create a script component
const script = entity.addComponent(ScriptComponent, 'PlayerController', scriptCode)

// Register it for hot reload
const hotReload = getHotReload()
hotReload.watch('PlayerController', script)
```

### 3. Reloading Scripts

When code changes are detected:

```typescript
const newCode = `
  function update(ctx) {
    // Updated code here
  }
`

await hotReload.reloadScript('PlayerController', newCode)
```

### 4. State Preservation

The system automatically:
1. Saves component variables before reload
2. Recompiles the script with new code
3. Restores saved variables after compilation
4. Maintains entity references and transforms

```typescript
// Before reload
script.variables = { health: 100, speed: 5.0 }

// After reload
// Variables are preserved!
script.variables.health === 100  // true
script.variables.speed === 5.0   // true
```

## Usage Examples

### Basic Script with Hot Reload

```typescript
// PlayerController.ts
let speed = 5.0
let jumpForce = 10.0

function start(ctx) {
  console.log('Player initialized')
}

function update(ctx) {
  if (!ctx.transform) return

  const horizontal = ctx.Input.getAxis('horizontal')
  const vertical = ctx.Input.getAxis('vertical')

  ctx.transform.translate(
    horizontal * speed * ctx.deltaTime,
    0,
    vertical * speed * ctx.deltaTime
  )
}
```

### Changing Values During Runtime

1. Open the script in the editor
2. Change `speed = 5.0` to `speed = 10.0`
3. Save (Ctrl+S) or wait 500ms
4. Script reloads automatically
5. Player moves faster immediately!

### Watching for Events

```typescript
const hotReload = getHotReload()

hotReload.addEventListener((event) => {
  switch (event.type) {
    case 'reload-start':
      console.log(`Reloading ${event.scriptName}...`)
      break

    case 'reload-success':
      console.log(`✓ ${event.scriptName} reloaded!`)
      break

    case 'reload-error':
      console.error(`✗ Error in ${event.scriptName}: ${event.error}`)
      break
  }
})
```

### Manual Reload

```typescript
// Force a reload from external source
const scriptCode = await fetchScriptFromFile('scripts/EnemyAI.js')
await hotReload.reloadScript('EnemyAI', scriptCode)
```

### Reload All Instances

```typescript
// Reload all entities using this script
const updatedCode = getUpdatedScriptCode()
await hotReload.reloadAllScripts('EnemyAI', updatedCode)
```

## UI Indicators

### Status States

- **Idle** (Gray) - Hot reload is not active
- **Watching** (Green) - Monitoring scripts for changes
- **Reloading** (Yellow, Pulsing) - Currently recompiling
- **Error** (Red) - Compilation failed

### Toast Notifications

Success messages appear for 3 seconds:
```
✓ PlayerController reloaded successfully
```

Error messages appear for 5 seconds:
```
✗ PlayerController: SyntaxError: Unexpected token
```

### Watched Scripts Counter

Shows how many scripts are being monitored:
```
5 scripts
```

## Best Practices

### 1. Use Clear Variable Names

```typescript
// Good - clear and descriptive
let playerSpeed = 5.0
let maxHealth = 100

// Bad - unclear
let s = 5.0
let h = 100
```

### 2. Initialize in start()

```typescript
let initialY = 0

function start(ctx) {
  // Save initial state
  if (ctx.transform) {
    initialY = ctx.transform.position.y
  }
}
```

### 3. Handle Errors Gracefully

```typescript
function update(ctx) {
  try {
    // Your code here
  } catch (error) {
    console.error('Error in update:', error)
  }
}
```

### 4. Test Changes Incrementally

Make small changes and test each one before making more changes.

### 5. Use Console Logging

```typescript
function update(ctx) {
  console.log('Speed:', speed, 'Position:', ctx.transform?.position)
}
```

## Limitations

1. **Lifecycle Methods**: The `start()` method is NOT re-called on reload. Use variables to track initialization state if needed.

2. **External References**: References to other entities or components may need to be refreshed:

```typescript
let targetEntity = null

function update(ctx) {
  // Re-find target if needed
  if (!targetEntity && ctx.engine) {
    targetEntity = ctx.engine.world.getEntityByName('Target')
  }
}
```

3. **Async Operations**: Pending promises or timers are not automatically cancelled:

```typescript
let timerId = null

function start(ctx) {
  timerId = setInterval(() => {
    // Do something
  }, 1000)
}

function onDestroy(ctx) {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}
```

## API Reference

### HotReload Class

#### Methods

- `initialize(world: World): void` - Initialize with engine world
- `start(): void` - Start watching for changes
- `stop(): void` - Stop watching
- `watch(scriptName: string, component: ScriptComponent): void` - Register script
- `unwatch(scriptName: string): void` - Unregister script
- `reloadScript(scriptName: string, newCode: string): Promise<boolean>` - Reload script
- `reloadAllScripts(scriptName: string, newCode: string): Promise<void>` - Reload all instances
- `addEventListener(listener: (event: HotReloadEvent) => void): void` - Add event listener
- `removeEventListener(listener: (event: HotReloadEvent) => void): void` - Remove listener
- `getStatus(): HotReloadStatus` - Get current status
- `getWatchedScripts(): string[]` - Get list of watched scripts
- `isWatching(scriptName: string): boolean` - Check if script is watched
- `enable(): void` - Enable hot reload
- `disable(): void` - Disable hot reload
- `dispose(): void` - Clean up resources

#### Events

```typescript
interface HotReloadEvent {
  type: 'reload-start' | 'reload-success' | 'reload-error'
  scriptName: string
  timestamp: number
  error?: string
}
```

#### Status Types

```typescript
type HotReloadStatus = 'idle' | 'watching' | 'reloading' | 'error'
```

## Troubleshooting

### Script Not Reloading

1. Check that the script is being watched:
   ```typescript
   hotReload.isWatching('MyScript')  // Should return true
   ```

2. Verify the script name matches:
   ```typescript
   script.scriptName === 'MyScript'  // Names must match
   ```

3. Check for compilation errors in console

### State Not Preserved

1. Make sure variables are declared at script scope:
   ```typescript
   // Correct - script scope
   let myVar = 10

   function update(ctx) {
     myVar++
   }
   ```

2. Variables inside functions are NOT preserved:
   ```typescript
   // Wrong - function scope
   function update(ctx) {
     let myVar = 10  // Lost on reload!
     myVar++
   }
   ```

### Performance Issues

1. Reduce poll interval if needed:
   ```typescript
   getHotReload({ pollInterval: 2000 })  // Check every 2 seconds
   ```

2. Disable hot reload in production:
   ```typescript
   const hotReload = getHotReload({ enabled: false })
   ```

## Future Enhancements

- File system watching via Tauri backend
- Script dependency tracking
- Hot reload history/rollback
- Performance profiling
- Script templates with hot reload support
- Multi-file script support
