/**
 * Pin and cluster mesh creation.
 * Pure factory functions that return THREE.js objects.
 */
import * as THREE from 'three'

/* ── Shared geometry (created once, reused by all pins) ─────────── */

const SPHERE_RADIUS = 0.18
let _sharedGeo = null

function getSharedSphereGeometry() {
  if (!_sharedGeo) _sharedGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 32, 24)
  return _sharedGeo
}

/* ── Pin mesh (glass orb + hit sphere) ──────────────────────────── */

/**
 * Creates a single pin as a translucent glass orb + invisible hit sphere.
 * Uses MeshPhysicalMaterial with transmission for realistic glass look.
 * @param {object} pin - Pin data.
 * @param {THREE.Color} headColor - Tint color for the glass.
 * @returns {THREE.Group}
 */
export function createPinMesh(pin, headColor) {
  const group = new THREE.Group()

  const orb = new THREE.Mesh(
    getSharedSphereGeometry(),
    new THREE.MeshLambertMaterial({
      color: headColor,
      emissive: headColor,
      emissiveIntensity: 0.25,
    })
  )
  orb.userData.pinData = pin

  // Slightly larger invisible sphere for easier click/hover targeting
  const hitSphere = new THREE.Mesh(
    new THREE.SphereGeometry(SPHERE_RADIUS * 1.25, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false })
  )
  hitSphere.userData.pinData = pin
  hitSphere.userData.isHitSphere = true

  group.add(orb, hitSphere)
  group.userData.pinData = pin
  group.userData.orb = orb
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
