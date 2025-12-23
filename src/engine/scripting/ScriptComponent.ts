import { Component } from '../ecs/Component'
import { Entity } from '../ecs/Entity'
import { Transform } from '../core/Transform'
import { Engine } from '../Engine'
import * as THREE from 'three'

export interface ScriptContext {
  entity: Entity
  transform: Transform | undefined
  engine: Engine | null
  deltaTime: number
  time: number
  THREE: typeof THREE
  Input: typeof Input
  console: Console
}

// Simple input helper for scripts
export const Input = {
  keys: new Set<string>(),
  keysDown: new Set<string>(),
  keysUp: new Set<string>(),
  mouse: { x: 0, y: 0, dx: 0, dy: 0 },
  mouseButtons: new Set<number>(),

  isKeyPressed(key: string): boolean {
    return this.keys.has(key.toLowerCase())
  },

  isKeyDown(key: string): boolean {
    return this.keysDown.has(key.toLowerCase())
  },

  isKeyUp(key: string): boolean {
    return this.keysUp.has(key.toLowerCase())
  },

  isMouseButtonPressed(button: number): boolean {
    return this.mouseButtons.has(button)
  },

  getAxis(axis: 'horizontal' | 'vertical'): number {
    if (axis === 'horizontal') {
      let val = 0
      if (this.keys.has('a') || this.keys.has('arrowleft')) val -= 1
      if (this.keys.has('d') || this.keys.has('arrowright')) val += 1
      return val
    } else {
      let val = 0
      if (this.keys.has('s') || this.keys.has('arrowdown')) val -= 1
      if (this.keys.has('w') || this.keys.has('arrowup')) val += 1
      return val
    }
  }
}

// Initialize input listeners
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase()
    if (!Input.keys.has(key)) {
      Input.keysDown.add(key)
    }
    Input.keys.add(key)
  })

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase()
    Input.keys.delete(key)
    Input.keysUp.add(key)
  })

  window.addEventListener('mousemove', (e) => {
    Input.mouse.dx = e.movementX
    Input.mouse.dy = e.movementY
    Input.mouse.x = e.clientX
    Input.mouse.y = e.clientY
  })

  window.addEventListener('mousedown', (e) => {
    Input.mouseButtons.add(e.button)
  })

  window.addEventListener('mouseup', (e) => {
    Input.mouseButtons.delete(e.button)
  })
}

// Clear per-frame input state
export function clearInputState() {
  Input.keysDown.clear()
  Input.keysUp.clear()
  Input.mouse.dx = 0
  Input.mouse.dy = 0
}

export interface CompiledScript {
  start?: (ctx: ScriptContext) => void
  update?: (ctx: ScriptContext) => void
  fixedUpdate?: (ctx: ScriptContext) => void
  lateUpdate?: (ctx: ScriptContext) => void
  onDestroy?: (ctx: ScriptContext) => void
}

export class ScriptComponent extends Component {
  public scriptName: string = 'NewScript'
  public sourceCode: string = ''
  private compiledScript: CompiledScript | null = null
  private startCalled: boolean = false
  private error: string | null = null
  private engine: Engine | null = null
  private startTime: number = Date.now()

  // Custom script variables that can be exposed to inspector
  public variables: Record<string, unknown> = {}

  constructor(entity: Entity, scriptName?: string, sourceCode?: string) {
    super(entity)
    if (scriptName) this.scriptName = scriptName
    if (sourceCode) {
      this.sourceCode = sourceCode
      this.compile()
    }
  }

  setEngine(engine: Engine): void {
    this.engine = engine
  }

  setSourceCode(code: string): void {
    this.sourceCode = code
    this.error = null
    this.startCalled = false
    this.compile()
  }

  getError(): string | null {
    return this.error
  }

  compile(): boolean {
    if (!this.sourceCode.trim()) {
      this.compiledScript = null
      return true
    }

    try {
      // Wrap the code in a function that returns the script object
      const wrappedCode = `
        'use strict';
        return (function() {
          ${this.sourceCode}

          // Return an object with lifecycle methods if they exist
          return {
            start: typeof start === 'function' ? start : undefined,
            update: typeof update === 'function' ? update : undefined,
            fixedUpdate: typeof fixedUpdate === 'function' ? fixedUpdate : undefined,
            lateUpdate: typeof lateUpdate === 'function' ? lateUpdate : undefined,
            onDestroy: typeof onDestroy === 'function' ? onDestroy : undefined
          };
        })();
      `

      // Create and execute the function
      const factory = new Function(wrappedCode)
      this.compiledScript = factory() as CompiledScript
      this.error = null
      this.startCalled = false
      return true
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
      this.compiledScript = null
      console.error(`[Script ${this.scriptName}] Compilation error:`, this.error)
      return false
    }
  }

  private getContext(deltaTime: number): ScriptContext {
    return {
      entity: this.entity,
      transform: this.entity.getComponent(Transform),
      engine: this.engine,
      deltaTime,
      time: (Date.now() - this.startTime) / 1000,
      THREE,
      Input,
      console
    }
  }

  private executeWithErrorHandling(fn: (ctx: ScriptContext) => void, ctx: ScriptContext): void {
    try {
      fn(ctx)
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
      console.error(`[Script ${this.scriptName}] Runtime error:`, this.error)
    }
  }

  onAttach(): void {
    this.startTime = Date.now()
    this.startCalled = false
  }

  onDetach(): void {
    if (this.compiledScript?.onDestroy) {
      this.executeWithErrorHandling(this.compiledScript.onDestroy, this.getContext(0))
    }
  }

  update(deltaTime: number): void {
    if (!this.compiledScript || !this.enabled) return

    const ctx = this.getContext(deltaTime)

    // Call start once
    if (!this.startCalled && this.compiledScript.start) {
      this.executeWithErrorHandling(this.compiledScript.start, ctx)
      this.startCalled = true
    }

    // Call update every frame
    if (this.compiledScript.update) {
      this.executeWithErrorHandling(this.compiledScript.update, ctx)
    }
  }

  fixedUpdate(fixedDeltaTime: number): void {
    if (!this.compiledScript || !this.enabled) return

    if (this.compiledScript.fixedUpdate) {
      this.executeWithErrorHandling(this.compiledScript.fixedUpdate, this.getContext(fixedDeltaTime))
    }
  }

  lateUpdate(deltaTime: number): void {
    if (!this.compiledScript || !this.enabled) return

    if (this.compiledScript.lateUpdate) {
      this.executeWithErrorHandling(this.compiledScript.lateUpdate, this.getContext(deltaTime))
    }
  }

  clone(newEntity: Entity): ScriptComponent {
    const clone = new ScriptComponent(newEntity, this.scriptName, this.sourceCode)
    clone.variables = { ...this.variables }
    return clone
  }

  serialize(): object {
    return {
      scriptName: this.scriptName,
      sourceCode: this.sourceCode,
      variables: this.variables
    }
  }

  deserialize(data: { scriptName?: string; sourceCode?: string; variables?: Record<string, unknown> }): void {
    if (data.scriptName) this.scriptName = data.scriptName
    if (data.sourceCode) {
      this.sourceCode = data.sourceCode
      this.compile()
    }
    if (data.variables) this.variables = data.variables
  }
}

// Default script templates
export const scriptTemplates = {
  empty: `// Script lifecycle methods:
// start(ctx) - Called once when the script starts
// update(ctx) - Called every frame
// fixedUpdate(ctx) - Called at fixed intervals (physics)
// lateUpdate(ctx) - Called after update
// onDestroy(ctx) - Called when the entity is destroyed

function start(ctx) {
  // Initialization code here
}

function update(ctx) {
  // Frame update code here
  // ctx.entity - The entity this script is attached to
  // ctx.transform - The entity's Transform component
  // ctx.deltaTime - Time since last frame in seconds
  // ctx.time - Time since script started
  // ctx.Input - Input helper (isKeyPressed, getAxis, etc.)
  // ctx.THREE - Three.js library
}
`,

  rotator: `// Rotates the entity continuously

let speed = 1.0;

function update(ctx) {
  if (!ctx.transform) return;

  ctx.transform.rotate(0, speed * ctx.deltaTime, 0);
}
`,

  playerController: `// Simple player movement controller

let moveSpeed = 5.0;
let rotateSpeed = 2.0;

function update(ctx) {
  if (!ctx.transform) return;

  // Get input axes
  const horizontal = ctx.Input.getAxis('horizontal');
  const vertical = ctx.Input.getAxis('vertical');

  // Move forward/backward
  const forward = ctx.transform.forward;
  ctx.transform.translate(
    forward.x * vertical * moveSpeed * ctx.deltaTime,
    0,
    forward.z * vertical * moveSpeed * ctx.deltaTime
  );

  // Rotate left/right
  ctx.transform.rotate(0, -horizontal * rotateSpeed * ctx.deltaTime, 0);
}
`,

  follower: `// Makes the entity follow another entity

let targetName = 'Target';
let followSpeed = 3.0;
let minDistance = 2.0;

function update(ctx) {
  if (!ctx.transform || !ctx.engine) return;

  // Find target entity
  const target = ctx.engine.world.getEntityByName(targetName);
  if (!target) return;

  const targetTransform = target.getComponent(ctx.engine.world.getEntitiesWithComponents()[0]?.getComponent);
  if (!targetTransform) return;

  // Calculate direction to target
  const direction = new ctx.THREE.Vector3();
  direction.subVectors(targetTransform.position, ctx.transform.position);

  const distance = direction.length();

  // Only move if beyond minimum distance
  if (distance > minDistance) {
    direction.normalize();
    ctx.transform.translate(
      direction.x * followSpeed * ctx.deltaTime,
      0,
      direction.z * followSpeed * ctx.deltaTime
    );
  }
}
`,

  oscillator: `// Makes the entity move up and down

let amplitude = 1.0;
let frequency = 1.0;
let startY = 0;

function start(ctx) {
  if (ctx.transform) {
    startY = ctx.transform.position.y;
  }
}

function update(ctx) {
  if (!ctx.transform) return;

  const y = startY + Math.sin(ctx.time * frequency * Math.PI * 2) * amplitude;
  ctx.transform.position.y = y;
}
`
}
