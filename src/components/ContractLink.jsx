function truncate(address) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export default function ContractLink({ label, address, chain, explorerUrl }) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg text-sm"
      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
    >
      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
      <span
        className="text-xs px-2 py-0.5 rounded"
        style={{
          fontFamily: "'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          backgroundColor: 'var(--bg-tertiary)',
          color: 'var(--text-secondary)'
        }}
      >
        {truncate(address)}
      </span>
      {chain ? (
        <span
          className="text-xs px-2.5 py-1 rounded-full"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        >
          {chain}
        </span>
      ) : null}
      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs"
          style={{ color: 'var(--text-secondary)' }}
          aria-label={`View ${label} on block explorer`}
        >
          View ↗
        </a>
      ) : null}
    </div>
  );
}
