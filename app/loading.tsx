export default function Loading() {
  return (
    <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Title shimmer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div className="animate-shimmer" style={{
          width: 200, height: 28, borderRadius: 'var(--radius-sm)',
          background: 'linear-gradient(90deg, var(--fill-quaternary) 25%, var(--fill-secondary) 50%, var(--fill-quaternary) 75%)',
          backgroundSize: '200% 100%',
        }} />
      </div>

      {/* Card grid shimmer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--separator)',
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}>
            <div className="animate-shimmer" style={{
              width: '60%', height: 16, borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(90deg, var(--fill-quaternary) 25%, var(--fill-secondary) 50%, var(--fill-quaternary) 75%)',
              backgroundSize: '200% 100%',
              animationDelay: `${i * 100}ms`,
            }} />
            <div className="animate-shimmer" style={{
              width: '100%', height: 12, borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(90deg, var(--fill-quaternary) 25%, var(--fill-secondary) 50%, var(--fill-quaternary) 75%)',
              backgroundSize: '200% 100%',
              animationDelay: `${i * 100 + 50}ms`,
            }} />
            <div className="animate-shimmer" style={{
              width: '80%', height: 12, borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(90deg, var(--fill-quaternary) 25%, var(--fill-secondary) 50%, var(--fill-quaternary) 75%)',
              backgroundSize: '200% 100%',
              animationDelay: `${i * 100 + 100}ms`,
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}
