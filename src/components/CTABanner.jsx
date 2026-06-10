import { Link } from 'react-router-dom';

export default function CTABanner({ title, description, primaryLabel, primaryTo, secondaryLabel, secondaryTo }) {
  return (
    <div
      className="rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
    >
      <h3
        className="text-xl sm:text-2xl font-bold mb-3"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        {title}
      </h3>
      {description ? (
        <p className="text-sm mb-6 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {description}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        {primaryLabel && primaryTo ? (
          <Link to={primaryTo} className="btn-flat primary">{primaryLabel}</Link>
        ) : null}
        {secondaryLabel && secondaryTo ? (
          <Link to={secondaryTo} className="btn-flat">{secondaryLabel}</Link>
        ) : null}
      </div>
    </div>
  );
}
