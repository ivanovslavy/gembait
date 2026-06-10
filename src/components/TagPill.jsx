export default function TagPill({ children }) {
  return (
    <span
      className="inline-block text-xs px-2.5 py-1 rounded-full"
      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
    >
      {children}
    </span>
  );
}
