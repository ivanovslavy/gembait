import { useTranslation } from 'react-i18next';

const colors = {
  live: { bg: 'rgba(5,150,105,0.06)', fg: '#059669' },
  testnet: { bg: 'rgba(245,158,11,0.06)', fg: '#D97706' },
  'in-progress': { bg: 'rgba(124,58,237,0.06)', fg: '#7C3AED' },
  'in-development': { bg: 'rgba(75,85,99,0.06)', fg: '#4B5563' }
};

export default function StatusBadge({ status, note, green }) {
  const { t } = useTranslation();
  // `green` forces the green (live) palette while keeping the real status label/note.
  const c = green ? colors.live : (colors[status] || colors['in-development']);
  const label = t(`products.status.${status}`);
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {label}
      {note ? <span style={{ opacity: 0.7 }}>· {note}</span> : null}
    </span>
  );
}
