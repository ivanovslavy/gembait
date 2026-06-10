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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-up delay-200">
        {sorted.map(product => (
          <ProductCard key={product.slug} product={product} lang={lang} />
        ))}
      </div>
    </div>
  );
}
