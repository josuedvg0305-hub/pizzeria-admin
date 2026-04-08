import React, { useState, useEffect } from 'react';
import './ClientDrawer.css';

export default function ClientDrawer({ client, onClose, onSave }) {
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [addresses, setAddresses] = useState([]);
  const [newAddr, setNewAddr] = useState('');

  useEffect(() => {
    if (client) {
      setFormData({ name: client.name || '', phone: client.phone || '' });
      setAddresses(Array.isArray(client.addresses) ? [...client.addresses] : []);
    } else {
      setFormData({ name: '', phone: '' });
      setAddresses([]);
    }
    setNewAddr('');
  }, [client]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddAddress = () => {
    const trimmed = newAddr.trim();
    if (!trimmed || addresses.includes(trimmed)) return;
    setAddresses(prev => [...prev, trimmed]);
    setNewAddr('');
  };

  const handleRemoveAddress = (idx) => {
    setAddresses(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave({ ...formData, addresses });
  };

  const isEdit = !!client;

  return (
    <div className="cd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cd-drawer">
        <div className="cd-header">
          <button className="cd-back-btn" onClick={onClose}>←</button>
          <span className="cd-title">{isEdit ? 'Administrar cliente' : 'Nuevo cliente'}</span>
        </div>

        <div className="cd-body">
          {isEdit && (
            <div className="cd-edit-header">
              <h2 className="cd-client-name">{client.name}</h2>
              <div className="cd-badges">
                <span className="cd-segment-badge">{client.segment}</span>
                <span className="cd-status-badge">
                  <span className={`cd-status-dot cd-dot--${client.status.toLowerCase().replace(' ', '-')}`}></span>
                  {client.status}
                </span>
              </div>
              <div className="cd-stats-block">
                <div className="cd-stat-row">
                  <span className="cd-stat-label">Total de pedidos</span>
                  <span className="cd-stat-val">{client.totalOrders}</span>
                </div>
                <div className="cd-stat-sub">
                  A domicilio: {Math.floor(client.totalOrders * 0.6)} · Para llevar: {Math.floor(client.totalOrders * 0.3)} · En el local: {Math.floor(client.totalOrders * 0.1)}
                </div>
                <div className="cd-stat-row" style={{ marginTop: '12px' }}>
                  <span className="cd-stat-label">Fecha de creación</span>
                  <span className="cd-stat-val">12/03/2026</span>
                </div>
              </div>
            </div>
          )}

          <div className="cd-form">
            <div className="cd-form-group">
              <label className="cd-label">Nombre Completo</label>
              <input
                className="cd-input"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ej. Juan Pérez"
              />
            </div>

            <div className="cd-form-group">
              <label className="cd-label">
                Teléfono
                {isEdit && formData.phone && (
                  <a
                    href={`https://wa.me/${formData.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="cd-wa-link"
                  >
                    WhatsApp Abrir conversación
                  </a>
                )}
              </label>
              <div className="cd-input-wrap">
                <div className="cd-phone-prefix">🇨🇱 +56</div>
                <input
                  className="cd-input cd-input--nocolor"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="9XXXXXXXX"
                />
              </div>
            </div>

            {/* ── Addresses ── */}
            <div className="cd-form-group">
              <label className="cd-label">Direcciones de entrega</label>

              {addresses.length === 0 ? (
                <p className="cd-no-addresses">Sin direcciones guardadas.</p>
              ) : (
                <div className="cd-address-list">
                  {addresses.map((addr, idx) => (
                    <div key={idx} className="cd-address-item">
                      <span className="cd-address-pin">📍</span>
                      <span className="cd-address-text">{addr}</span>
                      <button
                        className="cd-address-remove"
                        onClick={() => handleRemoveAddress(idx)}
                        title="Eliminar dirección"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="cd-add-address-row">
                <input
                  className="cd-input cd-input--new-addr"
                  placeholder="+ Agregar nueva dirección"
                  value={newAddr}
                  onChange={e => setNewAddr(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAddress(); }}}
                />
                <button
                  className="cd-add-addr-btn"
                  onClick={handleAddAddress}
                  disabled={!newAddr.trim()}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="cd-footer">
          <button className="cd-save-btn" onClick={handleSave}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
