import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getProductBySlug, getProductsByCategory } from '../data/products';
import StatusBadge from '../components/StatusBadge';
import TagPill from '../components/TagPill';
import MetricStat from '../components/MetricStat';
import ContractLink from '../components/ContractLink';
import CTABanner from '../components/CTABanner';
import ProductCard from '../components/ProductCard';
import CheckList from '../components/CheckList';
import NotFound from './NotFound';

function SectionHeading({ children }) {
  return (
    <h2
      className="text-2xl sm:text-3xl font-bold mb-6"
      style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
    >
      {children}
    </h2>
  );
}

function SubHeading({ children }) {
  return (
    <h3
      className="text-xs uppercase tracking-wider mb-3"
      style={{ color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.08em' }}
    >
      {children}
    </h3>
  );
}

function CardShell({ children, className = '' }) {
  return (
    <div
      className={`rounded-xl p-6 ${className}`}
      style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
    >
      {children}
    </div>
  );
}

export default function ProductDetail() {
  const { t, i18n } = useTranslation();
  const { lang, slug } = useParams();
  const product = getProductBySlug(slug);

  // Live platform stats (e.g. GembaTicket) — fetched from the product's statsUrl.
  const [liveStats, setLiveStats] = useState(null);
  useEffect(() => {
    const url = product?.statsUrl;
    if (!url) return;
    let alive = true;
    fetch(url).then(r => r.json()).then(d => { if (alive) setLiveStats(d); }).catch(() => {});
    return () => { alive = false; };
  }, [product?.statsUrl]);

  if (!product) return <NotFound />;

  const key = product.i18nKey;
  const resolvedLang = lang || i18n.language || 'en';
  const tagline = t(`products.${key}.tagline`);
  const heroIntro = t(`products.${key}.heroIntro`);
  const related = getProductsByCategory(product.category, product.slug).slice(0, 3);
  const cs = product.caseStudy || {};

  const appHref = product.appUrl
    || (product.slug === 'atlas' ? `/${resolvedLang}/contact?subject=Atlas%20early%20access` : null)
    || (product.slug === 'gembaticket' ? `/${resolvedLang}/contact?subject=GembaTicket%20early%20access` : null)
    || (product.slug === 'gembaescrow' ? `/${resolvedLang}/contact?subject=Gemba%20Escrow%20demo` : null)
    || (product.slug === 'gembawin' ? `/${resolvedLang}/contact?subject=GembaWin%20demo` : null);
  const appIsExternal = Boolean(product.appUrl);

  const features = t(`products.${key}.features.items`, { returnObjects: true, defaultValue: [] });
  const featuresArr = Array.isArray(features) ? features : [];
  const featuresIntro = t(`products.${key}.features.intro`, { defaultValue: '' });

  const useCases = t(`products.${key}.useCases.items`, { returnObjects: true, defaultValue: [] });
  const useCasesArr = Array.isArray(useCases) ? useCases : [];

  const archParagraphs = t(`products.${key}.architecture.paragraphs`, { returnObjects: true, defaultValue: [] });
  const archArr = Array.isArray(archParagraphs) ? archParagraphs : [];

  const whatWeAreItems = t(`products.${key}.whatWeAre.items`, { returnObjects: true, defaultValue: [] });
  const whatWeAreNotItems = t(`products.${key}.whatWeAreNot.items`, { returnObjects: true, defaultValue: [] });

  const securityItems = t(`products.${key}.security.items`, { returnObjects: true, defaultValue: [] });
  const securityItemsArr = Array.isArray(securityItems) ? securityItems : [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Breadcrumb */}
      <nav className="text-xs mb-8 flex flex-wrap gap-1" style={{ color: 'var(--text-tertiary)' }}>
        <Link to={`/${resolvedLang}`} style={{ color: 'var(--text-tertiary)' }}>{t('nav.home')}</Link>
        <span>›</span>
        <Link to={`/${resolvedLang}/products`} style={{ color: 'var(--text-tertiary)' }}>{t('nav.products')}</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-secondary)' }}>{product.name}</span>
      </nav>

      {/* Hero */}
      <header className="pt-2 pb-12">
        <div className="mb-5">
          <StatusBadge status={product.status} note={product.statusNote} green={product.statusGreen} />
        </div>
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1.1 }}
        >
          {product.name}
        </h1>
        <p
          className="text-lg sm:text-xl mb-6"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', fontWeight: 400, lineHeight: 1.45 }}
        >
          {tagline}
        </p>
        <p
          className="text-base max-w-3xl mb-8"
          style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}
        >
          {heroIntro}
        </p>
        <div className="flex flex-wrap gap-3">
          {appHref ? (
            appIsExternal ? (
              <a
                href={appHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-flat primary"
              >
                {product.appLabel} ↗
              </a>
            ) : (
              <Link to={appHref} className="btn-flat primary">{product.appLabel}</Link>
            )
          ) : null}
          {product.githubUrl ? (
            <a
              href={product.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-flat"
            >
              {t('productDetail.viewGithub')} ↗
            </a>
          ) : null}
          {(product.extraLinks || []).map((l, i) => {
            const label = t(`products.${key}.extraLinks.${i}`, { defaultValue: l.label });
            if (l.disabled || !l.url) {
              return (
                <span
                  key={i}
                  className="btn-flat"
                  style={{ opacity: 0.55, cursor: 'default' }}
                  aria-disabled="true"
                >
                  {label}
                </span>
              );
            }
            return (
              <a
                key={i}
                href={l.url}
                {...(l.download ? { download: '' } : { target: '_blank', rel: 'noopener noreferrer' })}
                className="btn-flat"
              >
                {label}{l.external ? ' ↗' : ''}
              </a>
            );
          })}
        </div>
        {product.githubNote ? (
          <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
            {product.githubNote}
          </p>
        ) : null}
      </header>

      {/* Metrics */}
      {product.metrics && product.metrics.length > 0 ? (
        <section className="mb-16">
          <div className={`grid gap-4 grid-cols-2 ${product.metrics.length >= 4 ? 'md:grid-cols-4' : 'md:grid-cols-' + product.metrics.length}`}>
            {product.metrics.map(m => {
              let value = m.value;
              if (liveStats && m.statKey && liveStats[m.statKey] != null) {
                const n = Number(liveStats[m.statKey]);
                value = (m.prefix || '') + (Number.isFinite(n) ? n.toLocaleString('en-US') : liveStats[m.statKey]);
              }
              return <MetricStat key={m.label} value={value} label={m.label} />;
            })}
          </div>
        </section>
      ) : null}

      {/* Problem / Solution */}
      {cs.hasProblem || cs.hasSolution ? (
        <section className="mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cs.hasProblem ? (
              <CardShell>
                <h2 className="text-xl font-bold mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {t(`products.${key}.problem.title`)}
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
                  {t(`products.${key}.problem.body`)}
                </p>
              </CardShell>
            ) : null}
            {cs.hasSolution ? (
              <CardShell>
                <h2 className="text-xl font-bold mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {t(`products.${key}.solution.title`)}
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
                  {t(`products.${key}.solution.body`)}
                </p>
              </CardShell>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* What it is / is not */}
      {cs.hasWhatWeAre && Array.isArray(whatWeAreItems) && whatWeAreItems.length > 0 ? (
        <section className="mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardShell>
              <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                {t(`products.${key}.whatWeAre.title`)}
              </h2>
              <CheckList items={whatWeAreItems} type="positive" />
            </CardShell>
            <CardShell>
              <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                {t(`products.${key}.whatWeAreNot.title`)}
              </h2>
              <CheckList items={Array.isArray(whatWeAreNotItems) ? whatWeAreNotItems : []} type="negative" />
            </CardShell>
          </div>
        </section>
      ) : null}

      {/* Key features */}
      {cs.hasFeatures && featuresArr.length > 0 ? (
        <section className="mb-16">
          <SectionHeading>{t(`products.${key}.features.title`)}</SectionHeading>
          {featuresIntro ? (
            <p className="text-base mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
              {featuresIntro}
            </p>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuresArr.map((f, i) => (
              <CardShell key={i}>
                <h3 className="text-base font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {f.title}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {f.desc}
                </p>
              </CardShell>
            ))}
          </div>
        </section>
      ) : null}

      {/* Architecture */}
      {cs.hasArchitecture && archArr.length > 0 ? (
        <section className="mb-16">
          <SectionHeading>{t(`products.${key}.architecture.title`)}</SectionHeading>
          <div className="flex flex-col gap-4">
            {archArr.map((p, i) => (
              <CardShell key={i}>
                <p className="text-base" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
                  {p}
                </p>
              </CardShell>
            ))}
          </div>
        </section>
      ) : null}

      {/* Use cases */}
      {cs.hasUseCases && useCasesArr.length > 0 ? (
        <section className="mb-16">
          <SectionHeading>{t(`products.${key}.useCases.title`)}</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {useCasesArr.map((u, i) => (
              <CardShell key={i}>
                <h3 className="text-base font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {u.title}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {u.desc}
                </p>
              </CardShell>
            ))}
          </div>
        </section>
      ) : null}

      {/* Technology */}
      {(product.tech?.length > 0 || product.networks?.length > 0 || product.contracts?.length > 0) ? (
        <section className="mb-16">
          <SectionHeading>{t('productDetail.technology')}</SectionHeading>
          {product.tech && product.tech.length > 0 ? (
            <div className="mb-6">
              <SubHeading>{t('productDetail.techStack')}</SubHeading>
              <div className="flex flex-wrap gap-2">
                {product.tech.map(tech => (
                  <TagPill key={tech}>{tech}</TagPill>
                ))}
              </div>
            </div>
          ) : null}

          {product.networks && product.networks.length > 0 ? (
            <div className="mb-6">
              <SubHeading>{t('productDetail.networks')}</SubHeading>
              <div className="flex flex-wrap gap-2">
                {product.networks.map(n => (
                  <TagPill key={n.name}>{n.name}</TagPill>
                ))}
                {product.networks[0]?.ready?.map(r => (
                  <TagPill key={`ready-${r}`}>
                    {r} ({t('productDetail.ready')})
                  </TagPill>
                ))}
              </div>
            </div>
          ) : null}

          {product.contracts && product.contracts.length > 0 ? (
            <div>
              <SubHeading>{t('productDetail.contracts')}</SubHeading>
              <div className="flex flex-col gap-2">
                {product.contracts.map(c => (
                  <ContractLink
                    key={`${c.label}-${c.chain}-${c.address}`}
                    label={c.label}
                    address={c.address}
                    chain={c.chain}
                    explorerUrl={c.explorerUrl}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Partners */}
      {product.partners && product.partners.length > 0 ? (
        <section className="mb-16">
          <SubHeading>{t('productDetail.partners')}</SubHeading>
          <div className="flex flex-wrap gap-2">
            {product.partners.map(p => (
              p.url ? (
                <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <TagPill>{p.name}</TagPill>
                </a>
              ) : (
                <TagPill key={p.name}>{p.name}</TagPill>
              )
            ))}
          </div>
        </section>
      ) : null}

      {/* Security */}
      {cs.hasSecurity ? (
        <section className="mb-16">
          <SectionHeading>{t(`products.${key}.security.title`)}</SectionHeading>
          <p className="text-base mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {t(`products.${key}.security.body`)}
          </p>
          {securityItemsArr.length > 0 ? (
            <CardShell>
              <div className="flex flex-col gap-3">
                {securityItemsArr.map((it, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-baseline sm:gap-4 py-2" style={i > 0 ? { borderTop: '1px solid var(--border-color)' } : {}}>
                    <div className="text-sm font-medium sm:w-1/3" style={{ color: 'var(--text-primary)' }}>
                      {it.label}
                    </div>
                    <div className="text-sm sm:flex-1" style={{ color: 'var(--text-secondary)' }}>
                      {it.value}
                    </div>
                  </div>
                ))}
              </div>
            </CardShell>
          ) : null}
        </section>
      ) : null}

      {/* Certifications */}
      {product.certifications && product.certifications.length > 0 ? (
        <section className="mb-16">
          <SubHeading>{t('productDetail.audits')}</SubHeading>
          <CardShell>
            <div className="flex flex-col gap-3">
              {product.certifications.map((c, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-baseline sm:gap-4 py-2" style={i > 0 ? { borderTop: '1px solid var(--border-color)' } : {}}>
                  <div className="text-sm font-medium sm:w-1/3" style={{ color: 'var(--text-primary)' }}>
                    {c.label}
                  </div>
                  <div className="text-sm sm:flex-1" style={{ color: 'var(--text-secondary)' }}>
                    {c.result}
                  </div>
                </div>
              ))}
            </div>
          </CardShell>
        </section>
      ) : null}

      {/* Related */}
      {related.length > 0 ? (
        <section className="mb-16">
          <SectionHeading>{t('productDetail.related')}</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {related.map(p => (
              <ProductCard key={p.slug} product={p} lang={resolvedLang} />
            ))}
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section>
        <CTABanner
          title={t('productDetail.cta.title')}
          description={t('productDetail.cta.description')}
          primaryLabel={t('productDetail.cta.primary')}
          primaryTo={`/${resolvedLang}/contact?subject=Technical+consultation`}
          secondaryLabel={t('productDetail.cta.secondary')}
          secondaryTo={`/${resolvedLang}/contact`}
        />
      </section>
    </div>
  );
}
