/**
 * deliveryCalculator.js
 * Utilidad pura para geocodificar una dirección y verificar si pertenece a un polígono de delivery.
 */

// Caché básico de geocodificación para evitar pegarle a la API dos veces por la misma dirección exacta
const geocodingCache = new Map()

/**
 * Calcula el costo de despacho basado en una dirección y el listado de zonas
 * @param {string} addressString - Ej: "Arturo Prat 450"
 * @param {Array} deliveryZones - Zonas [{ id, name, price, polygon: [{lat, lng}] }]
 * @returns {Promise<number | null>} - null si "Fuera de zona" o sin resultados. Number si hay una zona compatible.
 */
export async function calculateDeliveryPrice(addressString, deliveryZones) {
  if (!addressString || !addressString.trim()) return 0
  if (!deliveryZones || deliveryZones.length === 0) return 0
  if (!window.google || !window.google.maps) {
    console.warn('Google Maps API no está disponible.')
    return 0
  }

  const query = `${addressString}, Buin, Chile`

  try {
    let latLng
    
    // Check cache
    if (geocodingCache.has(query)) {
      latLng = geocodingCache.get(query)
    } else {
      const geocoder = new window.google.maps.Geocoder()
      const result = await geocoder.geocode({ address: query })
      
      if (!result.results || result.results.length === 0) {
        return null // No encontrado / error de dirección
      }
      
      latLng = result.results[0].geometry.location
      geocodingCache.set(query, latLng)
    }

    // Cruce geométrico
    for (const zone of deliveryZones) {
      if (!zone.polygon || zone.polygon.length < 3) continue

      // Instancia un polígono no visible solo para calcular
      const polygonInstance = new window.google.maps.Polygon({ paths: zone.polygon })
      const contains = window.google.maps.geometry.poly.containsLocation(latLng, polygonInstance)
      
      if (contains) {
        return Number(zone.price)
      }
    }

    // Retorna null explícito si la dirección existe pero no cae en ninguna zona
    return null

  } catch (error) {
    console.warn('Fallo en geocodificación:', error)
    // Si la API falla (ej un limite o "ZERO_RESULTS"), se trata como "fuera de zona / desconocido"
    return null
  }
}
