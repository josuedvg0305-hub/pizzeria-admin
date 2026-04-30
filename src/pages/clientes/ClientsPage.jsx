import React, { useState, useRef, useEffect } from 'react';
import { useClients } from '../../context/ClientContext';
import ClientSearchModal from './ClientSearchModal';
import ClientFilterModal from './ClientFilterModal';
import ClientDrawer from './ClientDrawer';
import './ClientsPage.css';

const PILLS = [
  'Todos',
  'Comprador Élite',
  'Comprador Top',
  'Comprador Frecuente'
];

export default function ClientsPage() {
  const { clients, saveClient, importBulkClients } = useClients();
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showSearch, setShowSearch] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  
  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  
  // Advanced filter states
  const [advFilters, setAdvFilters] = useState({ types: [], statuses: [], channels: [] });

  // Import/Export
  const [showIEMenu, setShowIEMenu] = useState(false);
  const fileInputRef = useRef(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Simple filter logic mapping
  const filteredClients = [...clients].filter(c => {
    // Top pills
    if (activeFilter !== 'Todos' && c.segment !== activeFilter) return false;
    
    // Advanced Filters
    if (advFilters.types.length > 0 && !advFilters.types.includes(c.segment)) return false;
    if (advFilters.statuses.length > 0 && !advFilters.statuses.includes(c.status)) return false;
    if (advFilters.channels.length > 0 && !advFilters.channels.includes(c.channel)) return false;
    
    return true;
  });

  if (sortConfig.key) {
    filteredClients.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, advFilters, sortConfig, clients]);

  // Pagination math
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentClients = filteredClients.slice(indexOfFirstItem, indexOfLastItem);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      setSortConfig({ key: null, direction: 'asc' });
      return;
    }
    setSortConfig({ key, direction });
  };

  const handleSaveClient = (data) => {
    saveClient(data, editingClient?.id ?? null);
    setIsDrawerOpen(false);
    setEditingClient(null);
  };

  const handleSelectClient = (c) => {
    setShowSearch(false);
    setEditingClient(c);
    setIsDrawerOpen(true);
  };

  /* ── CSV Export ── */
  const handleExportCSV = () => {
    const headers = ['Nombre', 'Telefono', 'Canal', 'Puntos', 'TotalPedidos', 'Segmento', 'Estado', 'Direcciones'];
    const rows = clients.map(c => {
      const addrs = Array.isArray(c.addresses) ? c.addresses.join(' | ') : (c.address ?? '');
      return [
        `"${(c.name        ?? '').replace(/"/g, '""')}"`,
        `"${(c.phone       ?? '').replace(/"/g, '""')}"`,
        `"${(c.channel     ?? '').replace(/"/g, '""')}"`,
        c.loyaltyPoints ?? 0,
        c.totalOrders   ?? 0,
        `"${(c.segment    ?? '').replace(/"/g, '""')}"`,
        `"${(c.status     ?? '').replace(/"/g, '""')}"`,
        `"${addrs.replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'clientes_pizzeria.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowIEMenu(false);
  };

  /* ── CSV Import ── */
  const handleImportCSV = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text  = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) throw new Error('El archivo está vacío o no tiene datos.');
        // Skip header row (index 0)
        const imported = lines.slice(1).map((line, idx) => {
          // Basic CSV split: handle quoted fields
          const cols = line.match(/(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g)
            ?.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? [];
          const [name, phone, channel, pointsStr, ordersStr, segment, status, addrsRaw] = cols;
          if (!name && !phone) return null;
          const addresses = addrsRaw
            ? addrsRaw.split('|').map(s => s.trim()).filter(Boolean)
            : [];
          return {
            id:            `cimport_${Date.now()}_${idx}`,
            name:          name    || 'Sin nombre',
            phone:         phone   || '',
            channel:       channel || 'Importado',
            loyaltyPoints: parseInt(pointsStr, 10)  || 0,
            totalOrders:   parseInt(ordersStr, 10)  || 0,
            segment:       segment || 'Comprador',
            status:        status  || 'Activo',
            addresses,
          };
        }).filter(Boolean);
        importBulkClients(imported);
        alert(`✅ ${imported.length} cliente(s) importado(s) correctamente.`);
      } catch (err) {
        alert(`❌ Error al leer el archivo CSV: ${err.message}`);
      }
    };
    reader.onerror = () => alert('❌ Error al acceder al archivo. Inténtalo de nuevo.');
    reader.readAsText(file, 'UTF-8');
    event.target.value = null; // allow re-upload of the same file
    setShowIEMenu(false);
  };

  const getStatusColorCls = (status) => {
    switch (status) {
      case 'Activo': return 'cp-dot--activo';
      case 'Durmiendo': return 'cp-dot--durmiendo';
      case 'En riesgo': return 'cp-dot--en-riesgo';
      default: return '';
    }
  };

  return (
    <div className="cp-page">
      {/* ── Top Header ── */}
      <div className="cp-header">
        <h1 className="cp-header-title">Clientes</h1>
        <div className="cp-header-actions">
          {/* Hidden file input for CSV import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImportCSV}
          />

          <button className="cp-btn cp-btn-ghost" onClick={() => setShowSearch(true)}>🔍 Buscar</button>

          {/* Import/Export dropdown */}
          <div className="cp-ie-wrap" style={{ position: 'relative' }}>
            <button
              className="cp-btn cp-btn-ghost"
              onClick={() => setShowIEMenu(v => !v)}
              onBlur={() => setTimeout(() => setShowIEMenu(false), 150)}
            >
              📊 Importar/Exportar ▼
            </button>
            {showIEMenu && (
              <div className="cp-ie-menu">
                <button
                  className="cp-ie-menu-item"
                  onMouseDown={() => fileInputRef.current?.click()}
                >
                  📥 Importar CSV
                </button>
                <button
                  className="cp-ie-menu-item"
                  onMouseDown={handleExportCSV}
                >
                  📤 Exportar CSV
                </button>
              </div>
            )}
          </div>

          <button className="cp-btn cp-btn-primary" onClick={() => { setEditingClient(null); setIsDrawerOpen(true); }}>+ Nuevo cliente</button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="cp-filter-bar">
        <div className="cp-filters-left">
          <button className="cp-btn cp-btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setShowFilter(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Filtro
          </button>
          
          {PILLS.map(pill => (
            <button
              key={pill}
              className={`cp-pill ${activeFilter === pill ? 'cp-pill--active' : ''}`}
              onClick={() => setActiveFilter(pill)}
            >
              {pill}
            </button>
          ))}
        </div>

        <div className="cp-filters-right">
          Total de clientes: {filteredClients.length}
        </div>
      </div>

      {/* ── Data Grid ── */}
      <div className="cp-content">
        <div className="cp-grid-container">
          
          <div className="cp-grid-header">
            <div>Cliente</div>
            <div>Canal de registro</div>
            <div className="cp-sort-th" onClick={() => handleSort('loyaltyPoints')}>
              Puntos de fidelidad {sortConfig.key === 'loyaltyPoints' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </div>
            <div className="cp-sort-th" onClick={() => handleSort('totalOrders')}>
              Total de pedidos {sortConfig.key === 'totalOrders' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </div>
            <div>Segmento</div>
            <div>Estado</div>
            <div style={{ textAlign: 'center' }}>Acciones</div>
          </div>

          <div className="cp-grid-body">
            {currentClients.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                No hay clientes para este criterio.
              </div>
            ) : (
              currentClients.map(client => (
                <div key={client.id} className="cp-grid-row" onClick={() => { setEditingClient(client); setIsDrawerOpen(true); }} style={{ cursor: 'pointer' }}>
                  
                  {/* Cliente */}
                  <div className="cp-cell">
                    <span className="cp-client-name">{client.name}</span>
                    <span className="cp-client-phone">{client.phone}</span>
                  </div>

                  {/* Canal */}
                  <div className="cp-cell">
                    <span className="cp-text-main">{client.channel}</span>
                  </div>

                  {/* Puntos de fidelidad */}
                  <div className="cp-cell" style={{ fontWeight: 600 }}>
                    {Number(client.loyaltyPoints).toLocaleString('es-CL')} pts
                  </div>

                  {/* Total de pedidos */}
                  <div className="cp-cell" style={{ fontWeight: 600 }}>
                    {client.totalOrders}
                  </div>

                  {/* Segmento */}
                  <div className="cp-cell">
                    <span className="cp-segment-badge">{client.segment}</span>
                  </div>

                  {/* Estado */}
                  <div className="cp-cell">
                    <span className="cp-status-badge">
                      <span className={`cp-status-dot ${getStatusColorCls(client.status)}`}></span>
                      {client.status}
                    </span>
                  </div>

                  {/* Acciones */}
                  <div className="cp-cell" style={{ alignItems: 'center' }}>
                    <button className="cp-action-btn" title="Opciones">⋮</button>
                  </div>

                </div>
              ))
            )}
          </div>

          {/* ── Pagination Footer ── */}
          <div className="flex justify-between items-center py-4 text-sm text-[var(--muted)] border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span>Elementos por página:</span>
              <select 
                className="bg-transparent border border-[var(--border)] rounded px-1 py-0.5 outline-none focus:border-[var(--brand)] transition-colors"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              <button 
                className="cp-btn cp-btn-ghost px-3 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                ← Anterior
              </button>
              <span>Página {currentPage} de {totalPages || 1}</span>
              <button 
                className="cp-btn cp-btn-ghost px-3 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Siguiente →
              </button>
            </div>
          </div>

        </div>
      </div>

      {showSearch && (
        <ClientSearchModal clients={clients} onClose={() => setShowSearch(false)} onSelectClient={handleSelectClient} />
      )}
      {showFilter && (
        <ClientFilterModal initialFilters={advFilters} onClose={() => setShowFilter(false)} onApplyFilters={setAdvFilters} />
      )}
      {isDrawerOpen && (
        <ClientDrawer client={editingClient} onClose={() => setIsDrawerOpen(false)} onSave={handleSaveClient} />
      )}
    </div>
  );
}
