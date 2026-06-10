export default function CheckList({ items, type = 'positive' }) {
  const mark = type === 'positive' ? '✓' : '✗';
  const color = type === 'positive' ? '#059669' : '#DC2626';
  return (
    <ul className="flex flex-col gap-3">
      {(items || []).map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className="text-base leading-6 shrink-0"
            style={{ color, fontWeight: 700 }}
            aria-hidden="true"
          >
            {mark}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}
