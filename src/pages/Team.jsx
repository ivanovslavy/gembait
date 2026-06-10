import { useTranslation } from 'react-i18next';

export default function Team() {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold mb-8 animate-fade-up" style={{ fontFamily: 'var(--font-display)' }}>{t('team.leadership')}</h1>
      <div className="rounded-xl p-6 sm:p-8 animate-fade-up delay-100" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(79,70,229,0.1)', color: '#4F46E5' }}><span className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>SI</span></div>
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t('team.name')}</h2>
            <p className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>{t('team.role')}</p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>{t('team.bio')}</p>
            <div className="rounded-lg p-4 italic text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderLeft: '3px solid #4F46E5', fontFamily: 'var(--font-display)' }}>"{t('team.tagline')}"</div>
          </div>
        </div>
      </div>
    </div>
  );
}
