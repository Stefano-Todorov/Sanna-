export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      background: '#0a0f14',
      position: 'relative',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(20,184,166,0.15), transparent 70%), radial-gradient(ellipse 40% 30% at 50% 80%, rgba(45,212,191,0.06), transparent)',
        pointerEvents: 'none',
      }} />
      <div style={{ width: '100%', maxWidth: 440, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontSize: 32,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #14b8a6, #2dd4bf)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: '0 0 4px',
          }}>Sana</h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Your autonomous marketing agent</p>
        </div>
        {children}
      </div>
    </div>
  )
}
