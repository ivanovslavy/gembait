import { useTranslation } from 'react-i18next';
import Section from '../components/Section';

export default function Privacy() {
  const { t } = useTranslation();
  const sections = t('privacy.sections', { returnObjects: true });

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1
        className="text-3xl sm:text-4xl font-bold mb-3 animate-fade-up"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('privacy.page_title')}
      </h1>
      <p
        className="text-sm mb-8 animate-fade-up delay-100"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {t('privacy.lastUpdated')}
      </p>
      <p
        className="text-base mb-12 animate-fade-up delay-100"
        style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}
      >
        {t('privacy.intro')}
      </p>
      <div className="animate-fade-up delay-200">
        {sections.map((sec) => (
          <Section key={sec.heading} title={sec.heading}>
            <p className="text-base" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {sec.body}
            </p>
          </Section>
        ))}
      </div>
    </div>
  );
}
