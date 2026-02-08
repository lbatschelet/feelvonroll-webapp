/**
 * Pin and cluster mesh creation.
 * Pure factory functions that return THREE.js objects.
 */
import * as THREE from 'three'

/**
 * Creates a single pin mesh (stem + head).
 * @param {object} pin - Pin data.
 * @param {THREE.Color} headColor - Color for the pin head.
 * @returns {THREE.Group}
 */
export function createPinMesh(pin, headColor) {
  const group = new THREE.Group()

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.026, 0.55, 10),
    new THREE.MeshStandardMaterial({ color: 0x4b5563 })
  )
  stem.position.y = 0.25

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    new THREE.MeshStandardMaterial({ color: headColor })
  )
  head.position.y = 0.52

  group.add(stem, head)
  group.userData.pinData = pin
  stem.userData.pinData = pin
  head.userData.pinData = pin
  group.userData.head = head
  return group
}

/**
 * Creates a cluster sprite showing the pin count.
 * @param {object} cluster - Cluster data with `pins` array.
 * @param {Map} textureCache - Cache for cluster textures.
 * @returns {THREE.Sprite}
 */
export function createClusterMesh(cluster, textureCache) {
  const texture = getClusterTexture(cluster.pins.length, textureCache)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(0.7, 0.7, 1)
  sprite.position.y += 0.5
  sprite.material.depthTest = false
  return sprite
}

/**
 * Gets or creates a cluster count texture (cached).
 * @param {number} count - Number of pins in cluster.
 * @param {Map} textureCache - Cache for cluster textures.
 * @returns {THREE.CanvasTexture}
 */
function getClusterTexture(count, textureCache) {
  if (textureCache.has(count)) {
    return textureCache.get(count)
  }
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#1f2937'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f9fafb'
  ctx.font = 'bold 48px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(count), size / 2, size / 2)
  const texture = new THREE.CanvasTexture(canvas)
  textureCache.set(count, texture)
  return texture
}
