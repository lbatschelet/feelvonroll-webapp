import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VIEW } from './config'

export function createRenderer(app) {
  // alpha: true makes the canvas transparent so the CSS background-color
  // (#f3f4f6 on #app / body) shows through.  This guarantees the canvas
  // background is pixel-identical to the CSS color that Safari also uses
  // for toolbar tinting — eliminating the visible seam between the
  // browser chrome and the WebGL content.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
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
  controls.dampingFactor = 0.3
  controls.panSpeed = 1.2
  controls.enablePan = true
  controls.enableZoom = true
  controls.enableRotate = false
  controls.screenSpacePanning = true
  controls.minDistance = VIEW.minDistance
  controls.maxDistance = VIEW.maxDistance
  controls.target.set(0, 3, 0)
  controls.update()
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  }
  controls.touches = {
    ONE: THREE.TOUCH.PAN,
    TWO: THREE.TOUCH.DOLLY_PAN,
  }

  controls.minPolarAngle = VIEW.polarAngle
  controls.maxPolarAngle = VIEW.polarAngle
  const fixedAzimuth = controls.getAzimuthalAngle()
  controls.minAzimuthAngle = fixedAzimuth
  controls.maxAzimuthAngle = fixedAzimuth
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
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.9 })
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0
  return mesh
}
