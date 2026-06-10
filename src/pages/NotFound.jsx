import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t, i18n } = useTranslation();
  const { lang: paramLang } = useParams();
  const lang = paramLang && ['en', 'bg', 'es'].includes(paramLang) ? paramLang : (i18n.language || 'en');

  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <div
        className="text-7xl sm:text-8xl font-bold mb-4"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        404
      </div>
      <h1
        className="text-2xl sm:text-3xl font-bold mb-3"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('notFound.title')}
      </h1>
      <p
        className="text-base mb-8"
        style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}
      >
        {t('notFound.message')}
      </p>
      <Link to={`/${lang}`} className="btn-flat primary text-sm">{t('notFound.cta')}</Link>
    </div>
  );
}
