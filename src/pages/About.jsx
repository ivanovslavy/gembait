import { useTranslation } from 'react-i18next';

export default function About() {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold mb-8 animate-fade-up" style={{ fontFamily: 'var(--font-display)' }}>{t('about.title')}</h1>
      <div className="space-y-4 mb-10 animate-fade-up delay-100">
        {['p1','p2','p3','p4','p5'].map(k => <p key={k} className="text-base" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>{t(`about.${k}`)}</p>)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up delay-200">
        {[{num:'20+',k:'years_it'},{num:'3',k:'networks'},{num:'12',k:'service_areas'},{num:'99.9%',k:'uptime'}].map(s=>(
          <div key={s.k} className="text-center py-4 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{s.num}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t(`about.stats.${s.k}`)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
