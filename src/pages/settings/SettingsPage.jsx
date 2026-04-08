import { useState, useCallback } from 'react'
import DeliveryMap from '../../components/settings/DeliveryMap'
import { useSettings } from '../../context/SettingsContext'
import './SettingsPage.css'

/* Colores disponibles para asignar a nuevas zonas */
const ZONE_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
]

/* Estado inicial del formulario de nueva zona */
const EMPTY_FORM = { name: '', price: '', color: ZONE_COLORS[0] }

export default function SettingsPage() {
  const { deliveryZones, addZone, updateZone, deleteZone } = useSettings()

  /* Polígono recién dibujado (coords temporales hasta que el usuario guarde) */
  const [pendingPolygon, setPendingPolygon] = useState(null)
  const [pendingMapRef,  setPendingMapRef]  = useState(null) // instancia polygon de gmaps

  /* Formulario de nueva zona */
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')

  /* Zona seleccionada (para edición futura) */
  const [selectedZoneId, setSelectedZoneId] = useState(null)

  /* ── Callbacks para el mapa ── */
  const handleZoneDrawn = useCallback((coords, polygonInstance) => {
    setPendingPolygon(coords)
    setPendingMapRef(polygonInstance)
  }, [])

  const handleZoneClick = useCallback((id) => {
    setSelectedZoneId(id)
  }, [])

  /* ── Guardar nueva zona ── */
  const handleSaveZone = () => {
    const name  = form.name.trim()
    const price = Number(form.price)

    if (!name)            return setFormError('El nombre de la zona es obligatorio.')
    if (!pendingPolygon)  return setFormError('Dibuja el polígono en el mapa antes de guardar.')
    if (isNaN(price) || price < 0) return setFormError('El precio debe ser un número positivo.')

    addZone({ name, price, color: form.color, polygon: pendingPolygon })

    // Limpiar estado temporal
    if (pendingMapRef) pendingMapRef.setMap(null)  // quitar el polígono editable temporal
    setPendingPolygon(null)
    setPendingMapRef(null)
    setForm(prev => ({
      ...EMPTY_FORM,
      color: ZONE_COLORS[(deliveryZones.length + 1) % ZONE_COLORS.length],
    }))
    setFormError('')
  }

  /* ── Cancelar polígono pendiente ── */
  const handleCancelDraw = () => {
    if (pendingMapRef) pendingMapRef.setMap(null)
    setPendingPolygon(null)
    setPendingMapRef(null)
    setFormError('')
  }

  /* ── Eliminar zona ── */
  const handleDeleteZone = (id) => {
    if (window.confirm('¿Seguro que deseas eliminar esta zona de delivery?')) {
      deleteZone(id)
      if (selectedZoneId === id) setSelectedZoneId(null)
    }
  }

  const fmt = (n) => `$${Number(n).toLocaleString('es-CL')}`

  return (
    <div className="sp-root">

      {/* ── Page header ── */}
      <div className="sp-header">
        <h1 className="sp-title">Configuración de Delivery</h1>
        <p className="sp-subtitle">
          Dibuja zonas de reparto en el mapa y asigna un costo de envío a cada una.
        </p>
      </div>

      <div className="sp-layout">

        {/* ── Mapa ── */}
        <div className="sp-map-col">
          <div className="sp-card">
            <div className="sp-card-head">
              <h2 className="sp-card-title">Mapa de zonas</h2>
              <span className="sp-card-hint">
                Usa el control del mapa para dibujar un polígono
              </span>
            </div>
            <DeliveryMap
              zones={deliveryZones}
              onZoneDrawn={handleZoneDrawn}
              onZoneClick={handleZoneClick}
            />
          </div>
        </div>

        {/* ── Sidebar derecho ── */}
        <div className="sp-side-col">

          {/* Formulario de nueva zona */}
          <div className="sp-card">
            <div className="sp-card-head">
              <h2 className="sp-card-title">
                {pendingPolygon ? '✅ Polígono dibujado' : '📍 Nueva zona'}
              </h2>
            </div>

            {!pendingPolygon ? (
              <p className="sp-hint">
                Dibuja un polígono en el mapa para crear una zona de delivery.
              </p>
            ) : (
              <div className="sp-form">
                <div className="sp-field">
                  <label className="sp-label" htmlFor="sp-zone-name">
                    Nombre de la zona
                  </label>
                  <input
                    id="sp-zone-name"
                    className="sp-input"
                    type="text"
                    placeholder="ej. Centro de Buin"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>

                <div className="sp-field">
                  <label className="sp-label" htmlFor="sp-zone-price">
                    Precio de delivery (CLP)
                  </label>
                  <input
                    id="sp-zone-price"
                    className="sp-input"
                    type="number"
                    min="0"
                    placeholder="ej. 2000"
                    value={form.price}
                    onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  />
                </div>

                <div className="sp-field">
                  <label className="sp-label">Color de la zona</label>
                  <div className="sp-color-row">
                    {ZONE_COLORS.map(c => (
                      <button
                        key={c}
                        className={`sp-color-dot${form.color === c ? ' sp-color-dot--active' : ''}`}
                        style={{ background: c }}
                        onClick={() => setForm(p => ({ ...p, color: c }))}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

                {formError && (
                  <p className="sp-error">{formError}</p>
                )}

                <div className="sp-btn-row">
                  <button className="sp-btn sp-btn--ghost" onClick={handleCancelDraw}>
                    Cancelar
                  </button>
                  <button className="sp-btn sp-btn--primary" onClick={handleSaveZone}>
                    Guardar zona
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Lista de zonas guardadas */}
          <div className="sp-card">
            <div className="sp-card-head">
              <h2 className="sp-card-title">Zonas guardadas</h2>
              <span className="sp-badge">{deliveryZones.length}</span>
            </div>

            {deliveryZones.length === 0 ? (
              <p className="sp-hint">Aún no hay zonas de delivery configuradas.</p>
            ) : (
              <ul className="sp-zone-list">
                {deliveryZones.map(zone => (
                  <li
                    key={zone.id}
                    className={`sp-zone-item${selectedZoneId === zone.id ? ' sp-zone-item--selected' : ''}`}
                    onClick={() => setSelectedZoneId(zone.id)}
                  >
                    <span
                      className="sp-zone-color"
                      style={{ background: zone.color }}
                    />
                    <div className="sp-zone-info">
                      <span className="sp-zone-name">{zone.name}</span>
                      <span className="sp-zone-price">{fmt(zone.price)} / delivery</span>
                    </div>
                    <button
                      className="sp-zone-del"
                      title="Eliminar zona"
                      onClick={e => { e.stopPropagation(); handleDeleteZone(zone.id) }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
