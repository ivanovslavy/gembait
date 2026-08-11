import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import GembaLogo from './GembaLogo';

export default function Footer() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <footer style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3"><GembaLogo size={28} /><span className="font-semibold text-base" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>GEMBA IT</span></div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t('footer.parent')}<br />{t('footer.location')}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3" style={{ fontFamily: 'var(--font-display)' }}>{t('nav.services')}</h4>
            <div className="flex flex-col gap-2">
              <Link to={`/${lang}/services`} className="text-sm no-underline" style={{ color: 'var(--text-secondary)' }}>DevOps & Infrastructure</Link>
              <Link to={`/${lang}/services`} className="text-sm no-underline" style={{ color: 'var(--text-secondary)' }}>Web3 & Blockchain</Link>
              <Link to={`/${lang}/services`} className="text-sm no-underline" style={{ color: 'var(--text-secondary)' }}>Payment Integrations</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3" style={{ fontFamily: 'var(--font-display)' }}>{t('nav.products')}</h4>
            <div className="flex flex-col gap-2">
              <Link to={`/${lang}/products/gembapay`} className="text-sm no-underline" style={{ color: 'var(--text-secondary)' }}>GembaPay</Link>
              <Link to={`/${lang}/products/gembaticket`} className="text-sm no-underline" style={{ color: 'var(--text-secondary)' }}>GembaTicket</Link>
              <Link to={`/${lang}/products/educhain`} className="text-sm no-underline" style={{ color: 'var(--text-secondary)' }}>EduChain</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3" style={{ fontFamily: 'var(--font-display)' }}>GEMBA Group</h4>
            <div className="flex flex-col gap-2">
              <a href="https://gembateam.com" target="_blank" rel="noopener noreferrer" className="text-sm no-underline" style={{ color: 'var(--text-secondary)' }}>gembateam.com ↗</a>
              <a href="https://gembaindustrial.com" target="_blank" rel="noopener noreferrer" className="text-sm no-underline" style={{ color: 'var(--text-secondary)' }}>Industrial Services ↗</a>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3" style={{ borderTop: '1px solid var(--border-color)' }}>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>© 2026 {t('footer.company')} — {t('footer.parent')}. {t('footer.rights')}.</p>
          <div className="flex gap-4">
            <Link to={`/${lang}/privacy`} className="text-xs no-underline" style={{ color: 'var(--text-tertiary)' }}>{t('footer.privacy')}</Link>
            <Link to={`/${lang}/terms`} className="text-xs no-underline" style={{ color: 'var(--text-tertiary)' }}>{t('footer.terms')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
