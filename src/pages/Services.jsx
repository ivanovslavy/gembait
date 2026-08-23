import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ServiceModal from '../components/ServiceModal';
import { serviceIcons, iconColors, iconBgs } from '../data/service-icons.jsx';

export default function Services() {
  const { t, i18n } = useTranslation();
  const services = t('services.items', { returnObjects: true });
  const modalLabels = t('services.modal', { returnObjects: true });
  const [activeIndex, setActiveIndex] = useState(null);
  const activeService = activeIndex !== null ? services[activeIndex] : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1
        className="text-3xl sm:text-4xl font-bold mb-2 animate-fade-up"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('services.page_title')}
      </h1>
      <p
        className="text-base mb-2 animate-fade-up delay-100"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('services.subtitle')}
      </p>
      <p
        className="text-xs mb-10 animate-fade-up delay-100"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {modalLabels.learnMoreHint}
      </p>
      <div className="space-y-4 animate-fade-up delay-200">
        {services.map((svc, i) => (
          <button
            key={svc.title}
            type="button"
            onClick={() => setActiveIndex(i)}
            className="service-card w-full text-left rounded-xl p-5 flex items-start gap-4"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
            }}
            aria-haspopup="dialog"
          >
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: iconBgs[i], color: iconColors[i] }}
            >
              <span style={{ display: 'inline-flex', transform: 'scale(1.5)' }}>
                {serviceIcons[i]}
              </span>
            </div>
            <div className="flex-1">
              <h3
                className="text-base font-semibold mb-1"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              >
                {svc.title}
              </h3>
              <p
                className="text-sm"
                style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}
              >
                {svc.desc}
              </p>
            </div>
          </button>
        ))}
      </div>
      <div
        className="mt-6 rounded-xl p-5 animate-fade-up delay-300"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <h3
          className="text-base font-semibold mb-1"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('services.support_title')}
        </h3>
        <p
          className="text-sm"
          style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}
        >
          {t('services.support_desc')}
        </p>
        <Link
          to={`/${i18n.language}/pricing`}
          className="inline-block mt-3 text-sm font-medium"
          style={{ color: '#4F46E5' }}
        >
          {t('nav.pricing')} →
        </Link>
      </div>
      <div className="mt-8 text-center">
        <Link to={`/${i18n.language}/contact`} className="btn-flat primary">
          {t('hero.cta')} →
        </Link>
      </div>

      {activeService && (
        <ServiceModal service={activeService} onClose={() => setActiveIndex(null)} />
      )}
    </div>
  );
}
