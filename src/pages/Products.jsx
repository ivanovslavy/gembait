import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { products } from '../data/products';
import ProductCard from '../components/ProductCard';

export default function Products() {
  const { t, i18n } = useTranslation();
  const { lang: paramLang } = useParams();
  const lang = paramLang && ['en', 'bg', 'es'].includes(paramLang) ? paramLang : (i18n.language || 'en');
  const sorted = [...products].sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <h1
        className="text-3xl sm:text-4xl font-bold mb-2 animate-fade-up"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('products.page_title')}
      </h1>
      <p
        className="text-base mb-10 animate-fade-up delay-100"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('products.subtitle')}
      </p>
      <a
        href="https://gmb.gembachain.io"
        target="_blank"
        rel="noopener noreferrer"
        className="block mb-10 rounded-2xl p-6 animate-fade-up delay-100 transition-transform hover:-translate-y-0.5"
        style={{
          background: 'linear-gradient(120deg, rgba(99,102,241,0.12), rgba(6,182,212,0.08))',
          border: '1px solid rgba(99,102,241,0.35)',
          textDecoration: 'none',
        }}
      >
        <div
          className="text-xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          {t('products.gmb.title')}
        </div>
        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('products.gmb.body')}
        </p>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('products.gmb.apps')}
        </p>
        <span className="text-sm font-semibold" style={{ color: '#06B6D4' }}>
          {t('products.gmb.cta')}
        </span>
      </a>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-up delay-200">
        {sorted.map(product => (
          <ProductCard key={product.slug} product={product} lang={lang} />
        ))}
      </div>
    </div>
  );
}
