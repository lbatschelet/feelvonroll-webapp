import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ORBIT_FEEL, VIEW } from './config'

/** Touch-Geräte: niedrigere DPR-Decke für flüssigeres Rendering grosser Szenen */
export function getPreferredPixelRatio() {
  if (typeof window === 'undefined') return 2
  const dpr = window.devicePixelRatio || 1
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches === true
  const cap = coarse ? 1.5 : 2
  return Math.min(dpr, cap)
}

export function createRenderer(app) {
  // alpha: true makes the canvas transparent so the CSS background-color
  // (#f3f4f6 on #app / body) shows through.  This guarantees the canvas
  // background is pixel-identical to the CSS color that Safari also uses
  // for toolbar tinting — eliminating the visible seam between the
  // browser chrome and the WebGL content.
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    // Helps with depth precision issues when models are large (e.g. meters-scale campus).
    logarithmicDepthBuffer: true,
  })
  renderer.setPixelRatio(getPreferredPixelRatio())
  renderer.setSize(app.clientWidth, app.clientHeight)
  renderer.setClearColor(0x000000, 0) // fully transparent clear
  app.appendChild(renderer.domElement)
  return renderer
}

export function createScene() {
  const scene = new THREE.Scene()
  // No scene.background → transparent, CSS background shows through
  return scene
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200)
  camera.position.copy(VIEW.cameraPosition)
  return camera
}

export function createControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement)
  controls.enableDamping = true
  controls.dampingFactor = ORBIT_FEEL.dampingFactor
  controls.zoomSpeed = ORBIT_FEEL.zoomSpeed
  controls.panSpeed = 1
  controls.enablePan = true
  controls.enableZoom = true
  controls.enableRotate = true
  // Keep panning parallel to the ground plane (XZ) instead of screen space.
  // This avoids the "pull camera away when dragging up/down" effect.
  controls.screenSpacePanning = false
  controls.minDistance = VIEW.minDistance
  controls.maxDistance = VIEW.maxDistance
  controls.target.set(0, 3, 0)
  controls.update()
  controls.mouseButtons = {
    // Desktop mouse / click-drag interaction:
    // - left drag -> pan (move map/model)
    // - middle drag -> rotate
    // - wheel handles zoom
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.ROTATE,
    RIGHT: THREE.MOUSE.PAN,
  }
  controls.touches = {
    // Touch gestures:
    // - one finger drag -> pan only
    // - two fingers -> zoom (rotation handled by explicit twist logic in main.js)
    ONE: THREE.TOUCH.PAN,
    TWO: THREE.TOUCH.DOLLY_PAN,
  }

  controls.minPolarAngle = VIEW.polarAngle
  controls.maxPolarAngle = VIEW.polarAngle
  return controls
}

export function addLights(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.7)
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(10, 18, 12)
  scene.add(ambient, dirLight)
}

export function createGround() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.9 })
  )
  mesh.rotation.x = -Math.PI / 2
  // Slightly below Y=0 to reduce z-fighting with exported floor geometry.
  mesh.position.y = -0.02
  // Default size (will be resized for glTF models).
  mesh.scale.set(2000, 2000, 1)
  return mesh
}
