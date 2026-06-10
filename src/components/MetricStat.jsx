export default function MetricStat({ value, label }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
    >
      <div
        className="text-3xl font-bold mb-1"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        {value}
      </div>
      <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
    </div>
  );
}
