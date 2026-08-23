import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import GembaLogo from '../components/GembaLogo';
import ProductCard from '../components/ProductCard';
import { getFeaturedProducts } from '../data/products';
import { serviceIcons, iconColors, iconBgs } from '../data/service-icons.jsx';
import postsData from '../../content/blog/posts.json';

const dateLocale = { en: 'en-US', bg: 'bg-BG', es: 'es-ES' };

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const services = t('services.items', { returnObjects: true });
  const recentPosts = [...postsData]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="text-center py-16 sm:py-24 px-4 relative overflow-hidden">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.06) 0%, transparent 70%)' }} />
        <div className="relative z-10">
          <div className="flex justify-center mb-6 animate-fade-up"><GembaLogo size={72} animated /></div>
          <span className="inline-block text-xs font-medium tracking-wider uppercase px-4 py-1.5 rounded-full mb-5 animate-fade-up delay-100" style={{ color: '#4F46E5', backgroundColor: 'rgba(79,70,229,0.08)' }}>{t('hero.badge')}</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight max-w-2xl mx-auto mb-4 animate-fade-up delay-200" style={{ fontFamily: 'var(--font-display)' }}>
            {t('hero.title1')} {t('hero.title_works')}. {t('hero.title2')} {t('hero.title_understand')}.
          </h1>
          <p className="text-base sm:text-lg max-w-xl mx-auto mb-8 animate-fade-up delay-300" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{t('hero.subtitle')}</p>
          <div className="flex gap-3 justify-center animate-fade-up delay-400">
            <Link to={`/${lang}/contact`} className="btn-flat primary">{t('hero.cta')} →</Link>
            <Link to={`/${lang}/products`} className="btn-outline">{t('hero.cta2')}</Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-12 px-4" style={{ borderTop: '1px solid var(--border-color)' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold text-center mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t('services.page_title')}</h2>
          <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>{t('services.subtitle')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {services.map((svc, i) => (
              <div key={i} className="rounded-lg p-4 transition-all duration-200 hover:-translate-y-0.5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                <div className="w-8 h-8 rounded-md flex items-center justify-center mb-2" style={{ backgroundColor: iconBgs[i], color: iconColors[i] }}>{serviceIcons[i]}</div>
                <h4 className="text-sm font-semibold mb-1" style={{ fontFamily: 'var(--font-display)' }}>{svc.title}</h4>
                <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{svc.desc}</p>
              </div>
            ))}
          </div>
          {/* Support banner */}
          <div className="mt-4 rounded-lg p-4 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(79,70,229,0.1)', color: '#4F46E5' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{t('services.support_title')}</h4>
              <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('services.support_desc')}</p>
            </div>
            <Link
              to={`/${lang}/pricing`}
              className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ backgroundColor: 'rgba(79,70,229,0.1)', color: '#4F46E5' }}
            >
              {t('nav.pricing')} →
            </Link>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="py-12 px-4" style={{ borderTop: '1px solid var(--border-color)' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold text-center mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t('products.page_title')}</h2>
          <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>{t('products.subtitle')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {getFeaturedProducts().map(p => <ProductCard key={p.slug} product={p} lang={lang} />)}
          </div>
          <div className="text-center mt-6">
            <Link to={`/${lang}/products`} className="btn-outline text-sm">{t('products.viewAll')} →</Link>
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="py-8 px-4 text-center" style={{ borderTop: '1px solid var(--border-color)' }}>
        <p className="text-xs uppercase tracking-wider mb-4" style={{ color: 'var(--text-tertiary)' }}>{t('tech.title')}</p>
        <div className="flex gap-3 justify-center flex-wrap max-w-3xl mx-auto">
          {['Node.js','React','PostgreSQL','MongoDB','MariaDB','Solidity','Linux','Docker','Cloudflare'].map(t => <span key={t} className="text-xs font-medium px-3.5 py-1.5 rounded-full" style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>{t}</span>)}
        </div>
      </section>

      {/* Blog preview */}
      <section className="py-12 px-4" style={{ borderTop: '1px solid var(--border-color)' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold text-center mb-6" style={{ fontFamily: 'var(--font-display)' }}>{t('blog.page_title')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {recentPosts.map((post) => {
              const title = post.title[lang] || post.title.en;
              const excerpt = truncate(post.excerpt[lang] || post.excerpt.en, 140);
              const dateStr = new Date(post.date).toLocaleDateString(
                dateLocale[lang] || 'en-US',
                { year: 'numeric', month: 'short', day: 'numeric' }
              );
              const firstTag = post.tags && post.tags[0];
              return (
                <Link
                  key={post.slug}
                  to={`/${lang}/blog/${post.slug}`}
                  className="block rounded-xl p-6 no-underline transition"
                  style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'inherit' }}
                >
                  <time
                    className="text-xs"
                    style={{ color: 'var(--text-tertiary)' }}
                    dateTime={post.date}
                  >
                    {dateStr}
                  </time>
                  <h4
                    className="text-sm font-semibold mt-2 mb-2"
                    style={{ fontFamily: 'var(--font-display)', lineHeight: 1.4 }}
                  >
                    {title}
                  </h4>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {excerpt}
                  </p>
                  {firstTag && (
                    <span
                      className="inline-block text-[10px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                    >
                      {firstTag}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <div className="text-center mt-6">
            <Link to={`/${lang}/blog`} className="btn-outline text-sm">{t('blog.viewAll')} →</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-14 px-4" style={{ borderTop: '1px solid var(--border-color)' }}>
        <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t('contact.title')}</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{t('contact.subtitle')}</p>
        <Link to={`/${lang}/contact`} className="btn-flat primary">{t('hero.cta')} →</Link>
      </section>
    </div>
  );
}
