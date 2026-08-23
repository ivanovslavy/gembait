import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { pricingServices } from '../data/pricing';

// The pricing catalogue: one card per service (mirrors the Products grid),
// followed by consulting rates, the monthly support plans and the offer note.
export default function Pricing() {
  const { t, i18n } = useTranslation();
  const { lang: paramLang } = useParams();
  const lang = paramLang && ['en', 'bg', 'es'].includes(paramLang) ? paramLang : (i18n.language || 'en');
  const rates = t('pricing.rates.items', { returnObjects: true, defaultValue: [] });
  const plans = t('pricing.plans.items', { returnObjects: true, defaultValue: [] });

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <h1
        className="text-3xl sm:text-4xl font-bold mb-2 animate-fade-up"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('pricing.page_title')}
      </h1>
      <p className="text-base mb-10 animate-fade-up delay-100" style={{ color: 'var(--text-secondary)' }}>
        {t('pricing.subtitle')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-up delay-200">
        {[...pricingServices].sort((a, b) => a.order - b.order).map((svc) => (
          <Link
            key={svc.slug}
            to={`/${lang}/pricing/${svc.slug}`}
            className="group block rounded-xl p-6 transition"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
          >
            <div className="mb-3">
              <span
                className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: 'rgba(79,70,229,0.1)', color: '#4F46E5' }}
              >
                {t(`pricing.items.${svc.i18nKey}.price`)}
              </span>
            </div>
            <h3
              className="text-xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              {t(`pricing.items.${svc.i18nKey}.title`)}
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t(`pricing.items.${svc.i18nKey}.card`)}
            </p>
            <span className="text-sm font-medium" style={{ color: '#4F46E5' }}>
              {t('pricing.labels.details')} →
            </span>
          </Link>
        ))}
      </div>

      {/* Consulting rates */}
      <h2 className="text-xl font-bold mt-14 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
        {t('pricing.rates.title')}
      </h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {rates.map((r) => (
          <div
            key={r.label}
            className="rounded-xl p-5"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
          >
            <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{r.price}</div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{r.label}</div>
          </div>
        ))}
      </div>

      {/* Monthly support plans */}
      <h2 className="text-xl font-bold mt-14 mb-1" style={{ fontFamily: 'var(--font-display)' }}>
        {t('pricing.plans.title')}
      </h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{t('pricing.plans.subtitle')}</p>
      <div className="grid sm:grid-cols-3 gap-4">
        {plans.map((p) => (
          <div
            key={p.name}
            className="rounded-xl p-5 flex flex-col"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: p.featured ? '2px solid #4F46E5' : '1px solid var(--border-color)',
            }}
          >
            <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{p.name}</div>
            <div className="text-2xl font-bold mt-1" style={{ fontFamily: 'var(--font-display)' }}>
              {p.price}
              <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>
                {t('pricing.plans.perMonth')}
              </span>
            </div>
            <ul className="text-xs mt-3 space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
              {p.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Offer / invoicing note + CTA */}
      <div className="mt-10 rounded-xl p-5" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('pricing.note')}
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('pricing.customNote')}{' '}
          <Link to={`/${lang}/contact`} className="font-medium" style={{ color: '#4F46E5' }}>
            {t('pricing.labels.contactUs')} →
          </Link>
        </p>
      </div>
      <div className="mt-8 text-center">
        <Link to={`/${lang}/contact`} className="btn-flat primary">
          {t('hero.cta')} →
        </Link>
      </div>
    </div>
  );
}
