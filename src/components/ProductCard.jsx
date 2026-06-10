import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StatusBadge from './StatusBadge';
import TagPill from './TagPill';

export default function ProductCard({ product, lang }) {
  const { t } = useTranslation();
  const tagline = t(`products.${product.i18nKey}.tagline`);
  const cardDescription = t(`products.${product.i18nKey}.cardDescription`);
  const techPreview = (product.tech || []).slice(0, 3);

  return (
    <Link
      to={`/${lang}/products/${product.slug}`}
      className="group block rounded-xl p-6 transition"
      style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color)'
      }}
    >
      <div className="mb-3">
        <StatusBadge status={product.status} note={product.statusNote} green={product.statusGreen} />
      </div>
      <h3
        className="text-xl font-bold mb-2"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        {product.name}
      </h3>
      <p
        className="text-base mb-3"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', fontWeight: 400, lineHeight: 1.5 }}
      >
        {tagline}
      </p>
      <p
        className="text-sm mb-4"
        style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}
      >
        {cardDescription}
      </p>
      {techPreview.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {techPreview.map(tech => (
            <TagPill key={tech}>{tech}</TagPill>
          ))}
          {product.tech.length > techPreview.length ? (
            <TagPill>+{product.tech.length - techPreview.length}</TagPill>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}
