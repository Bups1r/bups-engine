import * as THREE from 'three'

export type KeyState = 'up' | 'down' | 'pressed' | 'released'
export type MouseButton = 'left' | 'middle' | 'right'

export interface InputState {
  keys: Map<string, KeyState>
  mouse: {
    position: THREE.Vector2
    delta: THREE.Vector2
    buttons: Map<MouseButton, KeyState>
    wheel: number
  }
  gamepads: Map<number, GamepadState>
}

export interface GamepadState {
  connected: boolean
  axes: number[]
  buttons: boolean[]
  buttonStates: KeyState[]
}

class InputManagerClass {
  private state: InputState
  private previousKeys: Set<string> = new Set()
  private previousMouseButtons: Set<MouseButton> = new Set()
  private previousGamepadButtons: Map<number, Set<number>> = new Map()

  private element: HTMLElement | null = null
  private isLocked: boolean = false

  constructor() {
    this.state = {
      keys: new Map(),
      mouse: {
        position: new THREE.Vector2(),
        delta: new THREE.Vector2(),
        buttons: new Map(),
        wheel: 0
      },
      gamepads: new Map()
    }
  }

  initialize(element: HTMLElement): void {
    this.element = element

    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown.bind(this))
    window.addEventListener('keyup', this.onKeyUp.bind(this))

    // Mouse events
    element.addEventListener('mousedown', this.onMouseDown.bind(this))
    element.addEventListener('mouseup', this.onMouseUp.bind(this))
    element.addEventListener('mousemove', this.onMouseMove.bind(this))
    element.addEventListener('wheel', this.onWheel.bind(this))
    element.addEventListener('contextmenu', (e) => e.preventDefault())

    // Pointer lock
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this))

    // Gamepad events
    window.addEventListener('gamepadconnected', this.onGamepadConnected.bind(this))
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected.bind(this))
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown.bind(this))
    window.removeEventListener('keyup', this.onKeyUp.bind(this))

    if (this.element) {
      this.element.removeEventListener('mousedown', this.onMouseDown.bind(this))
      this.element.removeEventListener('mouseup', this.onMouseUp.bind(this))
      this.element.removeEventListener('mousemove', this.onMouseMove.bind(this))
      this.element.removeEventListener('wheel', this.onWheel.bind(this))
    }
  }

  update(): void {
    // Update key states
    for (const [key, state] of this.state.keys) {
      if (state === 'pressed') {
        this.state.keys.set(key, 'down')
      } else if (state === 'released') {
        this.state.keys.set(key, 'up')
      }
    }

    // Update mouse button states
    for (const [button, state] of this.state.mouse.buttons) {
      if (state === 'pressed') {
        this.state.mouse.buttons.set(button, 'down')
      } else if (state === 'released') {
        this.state.mouse.buttons.set(button, 'up')
      }
    }

    // Reset mouse delta and wheel
    this.state.mouse.delta.set(0, 0)
    this.state.mouse.wheel = 0

    // Update gamepad states
    this.pollGamepads()
  }

  // Keyboard
  isKeyDown(key: string): boolean {
    const state = this.state.keys.get(key.toLowerCase())
    return state === 'down' || state === 'pressed'
  }

  isKeyPressed(key: string): boolean {
    return this.state.keys.get(key.toLowerCase()) === 'pressed'
  }

  isKeyReleased(key: string): boolean {
    return this.state.keys.get(key.toLowerCase()) === 'released'
  }

  isKeyUp(key: string): boolean {
    const state = this.state.keys.get(key.toLowerCase())
    return state === 'up' || state === 'released' || state === undefined
  }

  getAxis(negative: string, positive: string): number {
    let value = 0
    if (this.isKeyDown(negative)) value -= 1
    if (this.isKeyDown(positive)) value += 1
    return value
  }

  // Mouse
  getMousePosition(): THREE.Vector2 {
    return this.state.mouse.position.clone()
  }

  getMouseDelta(): THREE.Vector2 {
    return this.state.mouse.delta.clone()
  }

  getMouseWheel(): number {
    return this.state.mouse.wheel
  }

  isMouseButtonDown(button: MouseButton): boolean {
    const state = this.state.mouse.buttons.get(button)
    return state === 'down' || state === 'pressed'
  }

  isMouseButtonPressed(button: MouseButton): boolean {
    return this.state.mouse.buttons.get(button) === 'pressed'
  }

  isMouseButtonReleased(button: MouseButton): boolean {
    return this.state.mouse.buttons.get(button) === 'released'
  }

  // Pointer lock
  requestPointerLock(): void {
    this.element?.requestPointerLock()
  }

  exitPointerLock(): void {
    document.exitPointerLock()
  }

  isPointerLocked(): boolean {
    return this.isLocked
  }

  // Gamepad
  getGamepad(index: number): GamepadState | undefined {
    return this.state.gamepads.get(index)
  }

  getGamepadAxis(index: number, axisIndex: number): number {
    const gamepad = this.state.gamepads.get(index)
    if (!gamepad || axisIndex >= gamepad.axes.length) return 0
    const value = gamepad.axes[axisIndex]
    // Apply deadzone
    return Math.abs(value) < 0.1 ? 0 : value
  }

  isGamepadButtonDown(index: number, buttonIndex: number): boolean {
    const gamepad = this.state.gamepads.get(index)
    if (!gamepad || buttonIndex >= gamepad.buttons.length) return false
    return gamepad.buttons[buttonIndex]
  }

  isGamepadButtonPressed(index: number, buttonIndex: number): boolean {
    const gamepad = this.state.gamepads.get(index)
    if (!gamepad || buttonIndex >= gamepad.buttonStates.length) return false
    return gamepad.buttonStates[buttonIndex] === 'pressed'
  }

  // Event handlers
  private onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase()
    if (!this.previousKeys.has(key)) {
      this.state.keys.set(key, 'pressed')
      this.previousKeys.add(key)
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase()
    this.state.keys.set(key, 'released')
    this.previousKeys.delete(key)
  }

  private onMouseDown(event: MouseEvent): void {
    const button = this.getMouseButtonName(event.button)
    if (!this.previousMouseButtons.has(button)) {
      this.state.mouse.buttons.set(button, 'pressed')
      this.previousMouseButtons.add(button)
    }
  }

  private onMouseUp(event: MouseEvent): void {
    const button = this.getMouseButtonName(event.button)
    this.state.mouse.buttons.set(button, 'released')
    this.previousMouseButtons.delete(button)
  }

  private onMouseMove(event: MouseEvent): void {
    if (this.isLocked) {
      this.state.mouse.delta.x += event.movementX
      this.state.mouse.delta.y += event.movementY
    } else {
      this.state.mouse.position.set(event.clientX, event.clientY)
      this.state.mouse.delta.set(event.movementX, event.movementY)
    }
  }

  private onWheel(event: WheelEvent): void {
    this.state.mouse.wheel = event.deltaY
  }

  private onPointerLockChange(): void {
    this.isLocked = document.pointerLockElement === this.element
  }

  private onGamepadConnected(event: GamepadEvent): void {
    const gamepad = event.gamepad
    this.state.gamepads.set(gamepad.index, {
      connected: true,
      axes: Array.from(gamepad.axes),
      buttons: gamepad.buttons.map(b => b.pressed),
      buttonStates: gamepad.buttons.map(() => 'up' as KeyState)
    })
    this.previousGamepadButtons.set(gamepad.index, new Set())
  }

  private onGamepadDisconnected(event: GamepadEvent): void {
    this.state.gamepads.delete(event.gamepad.index)
    this.previousGamepadButtons.delete(event.gamepad.index)
  }

  private pollGamepads(): void {
    const gamepads = navigator.getGamepads()
    for (const gamepad of gamepads) {
      if (!gamepad) continue

      const state = this.state.gamepads.get(gamepad.index)
      if (!state) continue

      const prevButtons = this.previousGamepadButtons.get(gamepad.index) || new Set()

      state.axes = Array.from(gamepad.axes)
      state.buttons = gamepad.buttons.map(b => b.pressed)

      // Update button states
      for (let i = 0; i < gamepad.buttons.length; i++) {
        const pressed = gamepad.buttons[i].pressed
        const wasPressed = prevButtons.has(i)

        if (pressed && !wasPressed) {
          state.buttonStates[i] = 'pressed'
          prevButtons.add(i)
        } else if (!pressed && wasPressed) {
          state.buttonStates[i] = 'released'
          prevButtons.delete(i)
        } else if (pressed) {
          state.buttonStates[i] = 'down'
        } else {
          state.buttonStates[i] = 'up'
        }
      }
    }
  }

  private getMouseButtonName(button: number): MouseButton {
    switch (button) {
      case 0: return 'left'
      case 1: return 'middle'
      case 2: return 'right'
      default: return 'left'
    }
  }
}

export const InputManager = new InputManagerClass()
