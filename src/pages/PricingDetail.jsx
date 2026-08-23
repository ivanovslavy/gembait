import { useTranslation } from 'react-i18next';
import { Link, useParams, Navigate } from 'react-router-dom';
import { getServiceBySlug } from '../data/pricing';

// One service, one page: the base price, exactly what it buys, what is quoted
// separately after a scoping consultation, and how an engagement works.
export default function PricingDetail() {
  const { t, i18n } = useTranslation();
  const { lang: paramLang, slug } = useParams();
  const lang = paramLang && ['en', 'bg', 'es'].includes(paramLang) ? paramLang : (i18n.language || 'en');
  const svc = getServiceBySlug(slug);
  if (!svc) return <Navigate to={`/${lang}/pricing`} replace />;
  const k = `pricing.items.${svc.i18nKey}`;
  const included = t(`${k}.included`, { returnObjects: true, defaultValue: [] });
  const extra = t(`${k}.extra`, { returnObjects: true, defaultValue: [] });
  const note = t(`${k}.note`, { defaultValue: '' });

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <nav className="text-xs mb-6 animate-fade-up" style={{ color: 'var(--text-tertiary)' }}>
        <Link to={`/${lang}`}>{t('nav.home')}</Link>
        {' › '}
        <Link to={`/${lang}/pricing`}>{t('nav.pricing')}</Link>
        {' › '}
        {t(`${k}.title`)}
      </nav>

      <div className="mb-2 animate-fade-up">
        <span
          className="inline-block text-sm font-semibold px-3 py-1 rounded-full"
          style={{ backgroundColor: 'rgba(79,70,229,0.1)', color: '#4F46E5' }}
        >
          {t(`${k}.price`)}
        </span>
      </div>
      <h1
        className="text-3xl sm:text-4xl font-bold mb-3 animate-fade-up"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t(`${k}.title`)}
      </h1>
      <p className="text-base mb-10 animate-fade-up delay-100" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {t(`${k}.summary`)}
      </p>

      <section className="mb-10 animate-fade-up delay-200">
        <h2 className="text-lg font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
          {t('pricing.labels.included')}
        </h2>
        <ul className="space-y-2.5">
          {included.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <span style={{ color: '#10B981', marginTop: 2 }}>✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10 animate-fade-up delay-200">
        <h2 className="text-lg font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
          {t('pricing.labels.extra')}
        </h2>
        <ul className="space-y-2.5">
          {extra.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <span style={{ color: '#4F46E5', marginTop: 2 }}>+</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {note && (
          <p className="text-sm mt-4" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{note}</p>
        )}
        <p className="text-sm mt-4" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('pricing.customNote')}{' '}
          <Link to={`/${lang}/contact`} className="font-medium" style={{ color: '#4F46E5' }}>
            {t('pricing.labels.contactUs')} →
          </Link>
        </p>
      </section>

      <section className="mb-10 rounded-xl p-5 animate-fade-up delay-300" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <h2 className="text-base font-semibold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          {t('pricing.how.title')}
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {t('pricing.how.body')}
        </p>
      </section>

      <div className="text-center">
        <Link to={`/${lang}/contact`} className="btn-flat primary">
          {t('hero.cta')} →
        </Link>
        <div className="mt-4">
          <Link to={`/${lang}/pricing`} className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            ← {t('pricing.labels.back')}
          </Link>
        </div>
      </div>
    </div>
  );
}
