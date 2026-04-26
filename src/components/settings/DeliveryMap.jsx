import { useEffect, useRef, useState } from 'react'
import './DeliveryMap.css'


/* ─────────────────────────────────────────────────────────────────────────────
   DeliveryMap ahora usa Google Maps de forma global (cargado via index.html)
   ───────────────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────────────
   COLORES por defecto para nuevas zonas (se rota cíclicamente)
   ───────────────────────────────────────────────────────────────────────────── */
const ZONE_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
]

/* ─────────────────────────────────────────────────────────────────────────────
   DeliveryMap
   Props:
     zones        — Array<{ id, name, price, color, polygon }> desde SettingsContext
     onZoneDrawn  — (polygonCoords: [{lat,lng}]) => void  llamado al terminar un polígono
     onZoneClick  — (zoneId: string) => void              llamado al hacer clic sobre una zona
   ───────────────────────────────────────────────────────────────────────────── */
const BUIN_CENTER = { lat: -33.732, lng: -70.742 }
const DEFAULT_ZOOM = 14

export default function DeliveryMap({ zones = [], onZoneDrawn, onZoneClick }) {
  const [loaded, setLoaded] = useState(() => !!(window.google && window.google.maps))

  // Escuchar si cargó asíncronamente
  useEffect(() => {
    if (loaded) return

    // Evitar múltiples inyecciones
    if (!document.getElementById('gmaps-script')) {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        console.error("VITE_GOOGLE_MAPS_API_KEY no está definida en .env")
        return
      }

      const script = document.createElement('script')
      script.id = 'gmaps-script'
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,places,geometry`
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    const interval = setInterval(() => {
      if (window.google && window.google.maps) {
        setLoaded(true)
        clearInterval(interval)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [loaded])

  const mapRef = useRef(null)   // div contenedor del mapa
  const mapInstance = useRef(null)   // instancia google.maps.Map
  const drawManager = useRef(null)   // instancia DrawingManager
  const zonePolygons = useRef({})    // { [zoneId]: google.maps.Polygon }

  /* ── Inicializar mapa + DrawingManager una sola vez al cargar el script ── */
  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstance.current) return


    // Mapa centrado en Buin
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: BUIN_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    })

    // DrawingManager — solo polígonos
    drawManager.current = new window.google.maps.drawing.DrawingManager({
      drawingMode: window.google.maps.drawing.OverlayType.POLYGON,
      drawingControl: true,
      drawingControlOptions: {
        position: window.google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [window.google.maps.drawing.OverlayType.POLYGON],
      },
      polygonOptions: {
        fillColor: ZONE_COLORS[0],
        fillOpacity: 0.25,
        strokeColor: ZONE_COLORS[0],
        strokeWeight: 2,
        editable: true,
        draggable: false,
      },
    })

    drawManager.current.setMap(mapInstance.current)

    // Evento: polígono recién dibujado por el usuario
    window.google.maps.event.addListener(
      drawManager.current,
      'polygoncomplete',
      (polygon) => {
        // Extraer coordenadas
        const coords = polygon.getPath().getArray().map(latlng => ({
          lat: latlng.lat(),
          lng: latlng.lng(),
        }))

        // Volver al modo sin dibujo después de completar un polígono
        drawManager.current.setDrawingMode(null)

        if (onZoneDrawn) onZoneDrawn(coords, polygon)
      }
    )
  }, [loaded, onZoneDrawn])

  /* ── Sincronizar polígonos existentes (zonas guardadas) con el mapa ── */
  useEffect(() => {
    if (!loaded || !mapInstance.current) return

    const currentIds = new Set(zones.map(z => z.id))

    // Eliminar polígonos que ya no existen
    Object.entries(zonePolygons.current).forEach(([id, poly]) => {
      if (!currentIds.has(id)) {
        poly.setMap(null)
        delete zonePolygons.current[id]
      }
    })

    // Añadir o actualizar polígonos existentes
    zones.forEach(zone => {
      if (!zone.polygon || zone.polygon.length < 3) return

      if (zonePolygons.current[zone.id]) {
        // Actualizar color si cambió
        zonePolygons.current[zone.id].setOptions({
          fillColor: zone.color,
          strokeColor: zone.color,
        })
      } else {
        // Crear nuevo polígono en el mapa
        const poly = new window.google.maps.Polygon({
          paths: zone.polygon,
          fillColor: zone.color,
          fillOpacity: 0.25,
          strokeColor: zone.color,
          strokeWeight: 2,
          editable: false,
          draggable: false,
        })
        poly.setMap(mapInstance.current)

        // Evento clic sobre la zona
        poly.addListener('click', () => {
          if (onZoneClick) onZoneClick(zone.id)
        })

        zonePolygons.current[zone.id] = poly
      }
    })
  }, [loaded, zones, onZoneClick])

  /* ── Render ── */

  return (
    <div className="dmap-root">
      {!loaded && (
        <div className="dmap-loading">
          <div className="dmap-spinner" />
          <span>Cargando Google Maps…</span>
        </div>
      )}
      <div
        ref={mapRef}
        className="dmap-canvas"
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </div>
  )
}
