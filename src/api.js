const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export async function fetchPins(floorIndex = null) {
  const url =
    floorIndex === null ? `${API_BASE}/pins.php` : `${API_BASE}/pins.php?floor=${floorIndex}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to load pins')
  }
  return response.json()
}

export async function createPin(payload) {
  const response = await fetch(`${API_BASE}/pins.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error('Failed to save pin')
  }
  return response.json()
}
