import React, { useState } from 'react';
import './ClientFilterModal.css';

export default function ClientFilterModal({ initialFilters, onClose, onApplyFilters }) {
  const [types, setTypes] = useState(initialFilters?.types || []);
  const [statuses, setStatuses] = useState(initialFilters?.statuses || []);
  const [channels, setChannels] = useState(initialFilters?.channels || []);

  const toggleFilter = (list, setList, val) => {
    if (list.includes(val)) setList(list.filter(item => item !== val));
    else setList([...list, val]);
  };

  const handleApply = () => {
    onApplyFilters({ types, statuses, channels });
    onClose();
  };

  return (
    <div className="cfm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cfm-drawer" onClick={e => e.stopPropagation()}>
        <div className="cfm-header">
          <span className="cfm-title">Filtros Avanzados</span>
          <button className="cfm-close" onClick={onClose}>✕</button>
        </div>

        <div className="cfm-body">
          <div className="cfm-section">
            <span className="cfm-sec-title">Tipo de cliente</span>
            <div className="cfm-sec-opts">
              {[
                { val: 'Comprador Élite', label: 'Comprador Élite (Más de 8)' },
                { val: 'Comprador Top', label: 'Comprador Top (5 a 7)' },
                { val: 'Comprador Frecuente', label: 'Comprador Frecuente' },
                { val: 'Comprador', label: 'Comprador' }
              ].map(opt => (
                <label key={opt.val} className="cfm-check-label">
                  <input type="checkbox" checked={types.includes(opt.val)} onChange={() => toggleFilter(types, setTypes, opt.val)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="cfm-section">
            <span className="cfm-sec-title">Estatus de cliente</span>
            <div className="cfm-sec-opts">
              {['Activo', 'Inactivo', 'Durmiendo', 'En riesgo'].map(opt => (
                <label key={opt} className="cfm-check-label">
                  <input type="checkbox" checked={statuses.includes(opt)} onChange={() => toggleFilter(statuses, setStatuses, opt)} />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div className="cfm-section">
            <span className="cfm-sec-title">Canal de creación</span>
            <div className="cfm-sec-opts">
              {['Menú digital', 'Directo', 'PDV', 'Chatbot'].map(opt => (
                <label key={opt} className="cfm-check-label">
                  <input type="checkbox" checked={channels.includes(opt)} onChange={() => toggleFilter(channels, setChannels, opt)} />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="cfm-footer">
          <button className="cfm-apply-btn" onClick={handleApply}>Filtrar ahora</button>
        </div>
      </div>
    </div>
  );
}
