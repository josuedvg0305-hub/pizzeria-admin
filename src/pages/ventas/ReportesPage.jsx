export default function ReportesPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 12,
      color: 'var(--muted)',
    }}>
      <span style={{ fontSize: 48 }}>📊</span>
      <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text, #111)' }}>Reportes</span>
      <span style={{ fontSize: 14 }}>Próximamente — estadísticas de ventas y gráficos</span>
    </div>
  )
}
