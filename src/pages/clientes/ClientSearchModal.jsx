import React, { useState } from 'react';
import './ClientSearchModal.css';

export default function ClientSearchModal({ clients, onClose, onSelectClient }) {
  const [searchType, setSearchType] = useState('name'); // 'name' | 'phone'
  const [query, setQuery] = useState('');

  // Handle outside click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const results = query.trim() ? clients.filter(c => {
    if (searchType === 'name') {
      return c.name.toLowerCase().includes(query.toLowerCase());
    } else {
      const qNum = query.replace(/\D/g, '');
      const cNum = (c.phone || '').replace(/\D/g, '');
      return cNum.includes(qNum);
    }
  }) : [];

  return (
    <div className="csm-overlay" onClick={handleOverlayClick}>
      <div className="csm-modal">
        <div className="csm-header">
          <span className="csm-title">Buscar cliente</span>
          <button className="csm-close" onClick={onClose}>✕</button>
        </div>

        <div className="csm-body">
          <div className="csm-search-row">
            <select
              className="csm-select"
              value={searchType}
              onChange={(e) => { setSearchType(e.target.value); setQuery(''); }}
            >
              <option value="name">👤 Nombre</option>
              <option value="phone">📞 Teléfono</option>
            </select>

            <div className={`csm-input-wrap ${searchType === 'phone' ? 'csm-input-wrap--phone' : ''}`}>
              {searchType === 'phone' && (
                <div className="csm-phone-prefix">+ 56</div>
              )}
              <input
                className="csm-input"
                type={searchType === 'phone' ? 'tel' : 'text'}
                placeholder={searchType === 'phone' ? 'Número de cliente' : 'Nombre de cliente'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="csm-results">
            {query.trim() === '' ? (
              <div className="csm-empty">Ingresa un término para buscar.</div>
            ) : results.length === 0 ? (
              <div className="csm-empty">No se han encontrado resultados.</div>
            ) : (
              <div className="csm-list">
                {results.map(c => (
                  <div key={c.id} className="csm-list-item" onClick={() => onSelectClient(c)}>
                    <div className="csm-li-left">
                      <div className="csm-li-name">{c.name}</div>
                      <div className="csm-li-phone">{c.phone}</div>
                    </div>
                    <div className="csm-li-right">
                      <span className="csm-li-badge">{c.segment}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
