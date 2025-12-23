# AI Context System

The AI context system provides context-aware assistance by automatically including relevant engine state information when communicating with the AI assistant.

## Features

### Context Builder (`ContextBuilder.ts`)

The `ContextBuilder` class collects and formats engine state information including:

1. **Selected Entity Context**
   - Entity name and ID
   - Transform data (position, rotation, scale)
   - Component list
   - Parent/child relationships
   - Tags

2. **Scene Context**
   - Scene name and statistics
   - Total entity count
   - Root entity hierarchy
   - System information

3. **Error & Warning Tracking**
   - Recent console errors (up to 10)
   - Recent console warnings (up to 10)
   - Automatic console interception

4. **Project Context**
   - Engine name
   - Play state
   - Current FPS

## Usage

### In Chat Component

The context builder is automatically integrated with the Chat component:

```typescript
import { contextBuilder } from '../engine/ai/ContextBuilder'

// Update context when engine/entity changes
contextBuilder.setEngine(engine)
contextBuilder.setSelectedEntity(selectedEntity)

// Build context string for AI
const contextString = contextBuilder.buildContextString()
```

### Manual Context Building

```typescript
import { contextBuilder } from '@/engine'

// Get structured context
const context = contextBuilder.buildContext()

// Get formatted context string
const contextString = contextBuilder.buildContextString(
  includeErrors: true,  // Include errors/warnings
  includeScene: true    // Include scene hierarchy
)

// Get summary for UI display
const summary = contextBuilder.getSummary()

// Check if there's relevant context
const hasContext = contextBuilder.hasRelevantContext()
```

### Error Tracking

The context builder automatically intercepts console errors and warnings:

```typescript
// Errors are automatically captured
console.error('Something went wrong') // Captured

// Manually add errors
contextBuilder.addError('Custom error message')

// Clear errors
contextBuilder.clearErrors()
contextBuilder.clearWarnings()
```

## Context Format

When included in AI messages, context is formatted as:

```
=== Engine Context ===
Engine: Bups Game Engine
Playing: false
FPS: 60

=== Selected Entity ===
Name: Player
ID: 5
Position: (0.00, 1.00, 0.00)
Rotation: (0.00, 0.00, 0.00)
Scale: (1.00, 1.00, 1.00)
Components: Transform, MeshRenderer, RigidBody

=== Scene ===
Name: MainWorld
Entities: 12
Components: 24
Systems: 3
Root Entities:
  - Camera (0 children)
  - Player (2 children)
  - Environment (5 children)

=== Recent Errors ===
[10:30:45] Failed to load texture: missing_texture.png
```

## UI Integration

The Chat component displays context status:

- **Context Indicator**: Shows when context is being included (green dot + summary)
- **Context Toggle**: Checkbox to enable/disable context inclusion
- **Context Details**: Expandable view to see what context was sent with each message

## Best Practices

1. **Keep context relevant**: The system automatically includes only relevant context
2. **Monitor error logs**: Errors are limited to 10 most recent entries
3. **Use for debugging**: Context is especially helpful when asking about specific entities or errors
4. **Toggle when needed**: Disable context for general questions that don't need engine state
