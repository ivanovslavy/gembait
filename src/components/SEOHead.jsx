import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { products, getProductBySlug } from '../data/products';
import { staticMeta } from '../data/seoMeta';
import posts from '../../content/blog/posts.json';

const BASE_URL = 'https://gembait.com';
const LANGS = ['en', 'bg', 'es'];
const LOCALE = { en: 'en_US', bg: 'bg_BG', es: 'es_ES' };

const CATEGORY_TO_SCHEMA = {
  web3:      'FinanceApplication',
  payments:  'FinanceApplication',
  nft:       'FinanceApplication',
  saas:      'BusinessApplication',
  education: 'EducationalApplication',
};

function cap(str, max = 160) {
  if (!str) return '';
  const s = String(str).trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

function absolute(pathname) {
  return `${BASE_URL}${pathname}`;
}

function swapLang(pathname, targetLang) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return `/${targetLang}`;
  if (LANGS.includes(parts[0])) parts[0] = targetLang;
  else parts.unshift(targetLang);
  return '/' + parts.join('/');
}

function ogImageForPath({ section, subSlug, product, post }) {
  if (section === 'products' && subSlug && product) {
    return `${BASE_URL}/og/${product.slug}.png`;
  }
  if (section === 'blog' && post && post.image) {
    // Fallback to per-post image when present — else default.
    return post.image.startsWith('http') ? post.image : `${BASE_URL}${post.image}`;
  }
  return `${BASE_URL}/og/default.png`;
}

export default function SEOHead() {
  const { i18n, t } = useTranslation();
  const location = useLocation();

  const parts = location.pathname.split('/').filter(Boolean);
  const urlLang = LANGS.includes(parts[0]) ? parts[0] : null;
  const lang = urlLang || i18n.language || 'en';
  const section = parts[1] || 'home';
  const subSlug = parts[2] || null;

  let title;
  let description;
  let ogType = 'website';
  let robots = 'index,follow';
  let product = null;
  let post = null;
  const jsonLd = [];

  const baseStatic = staticMeta[lang] || staticMeta.en;

  if (section === 'products' && subSlug) {
    product = getProductBySlug(subSlug);
    if (product) {
      const tagline = t(`products.${product.i18nKey}.tagline`, { defaultValue: '' }) || '';
      const cardDesc = t(`products.${product.i18nKey}.cardDescription`, { defaultValue: '' }) || '';
      title = cap(`${product.name} — GEMBA IT`, 60);
      description = cap(cardDesc || tagline || product.name, 160);

      const schemaType = CATEGORY_TO_SCHEMA[product.category] || 'SoftwareApplication';
      const canonical = absolute(location.pathname);
      const ogImageAbs = `${BASE_URL}/og/${product.slug}.png`;

      jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        additionalType: schemaType,
        name: product.name,
        url: canonical,
        description: cap(tagline || cardDesc || product.name, 300),
        applicationCategory: schemaType,
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        creator: {
          '@type': 'Organization',
          name: 'GEMBA IT',
          url: BASE_URL,
        },
        image: ogImageAbs,
        softwareVersion: '1.0',
      });

      const homeLabel = t('nav.home', { defaultValue: 'Home' });
      const productsLabel = t('nav.products', { defaultValue: 'Products' });
      jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: homeLabel, item: `${BASE_URL}/${lang}` },
          { '@type': 'ListItem', position: 2, name: productsLabel, item: `${BASE_URL}/${lang}/products` },
          { '@type': 'ListItem', position: 3, name: product.name, item: canonical },
        ],
      });
    } else {
      title = cap(baseStatic.home.title, 60);
      description = cap(baseStatic.home.desc, 160);
      robots = 'noindex,nofollow';
    }
  } else if (section === 'products') {
    title = cap(baseStatic.products.title, 60);
    description = cap(baseStatic.products.desc, 160);
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: baseStatic.products.title,
      url: absolute(location.pathname),
      description: baseStatic.products.desc,
      hasPart: {
        '@type': 'ItemList',
        numberOfItems: products.length,
        itemListElement: [...products]
          .sort((a, b) => a.order - b.order)
          .map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${BASE_URL}/${lang}/products/${p.slug}`,
            name: p.name,
          })),
      },
    });
  } else if (section === 'blog' && subSlug) {
    post = posts.find((p) => p.slug === subSlug);
    if (post) {
      const postTitle = post.title[lang] || post.title.en;
      const postExcerpt = post.excerpt[lang] || post.excerpt.en;
      title = cap(`${postTitle} — GEMBA IT`, 70);
      description = cap(postExcerpt, 160);
      ogType = 'article';

      jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: postTitle,
        description: postExcerpt,
        author: { '@type': 'Person', name: post.author },
        datePublished: post.date,
        dateModified: post.date,
        inLanguage: lang,
        image: `${BASE_URL}/og/default.png`,
        publisher: {
          '@type': 'Organization',
          name: 'GEMBA IT',
          logo: { '@type': 'ImageObject', url: `${BASE_URL}/favicon.svg` },
        },
        mainEntityOfPage: absolute(location.pathname),
        keywords: (post.tags || []).join(', '),
      });
    } else {
      title = cap(baseStatic.blog.title, 60);
      description = cap(baseStatic.blog.desc, 160);
      robots = 'noindex,nofollow';
    }
  } else if (section === 'blog') {
    title = cap(baseStatic.blog.title, 60);
    description = cap(baseStatic.blog.desc, 160);
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: baseStatic.blog.title,
      url: absolute(location.pathname),
      description: baseStatic.blog.desc,
      inLanguage: lang,
      publisher: { '@type': 'Organization', name: 'GEMBA IT', url: BASE_URL },
      blogPost: posts.slice(0, 10).map((p) => ({
        '@type': 'BlogPosting',
        headline: p.title[lang] || p.title.en,
        url: `${BASE_URL}/${lang}/blog/${p.slug}`,
        datePublished: p.date,
        author: { '@type': 'Person', name: p.author },
      })),
    });
  } else {
    const key = ['services', 'about', 'team', 'careers', 'contact', 'privacy', 'terms', 'home'].includes(section)
      ? section
      : 'home';
    title = cap(baseStatic[key].title, 60);
    description = cap(baseStatic[key].desc, 160);
  }

  const canonicalUrl = absolute(location.pathname);
  const ogImage = ogImageForPath({ section, subSlug, product, post });

  return (
    <Helmet>
      <html lang={lang} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={canonicalUrl} />

      {LANGS.map((l) => (
        <link
          key={l}
          rel="alternate"
          hrefLang={l}
          href={`${BASE_URL}${swapLang(location.pathname, l)}`}
        />
      ))}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${BASE_URL}${swapLang(location.pathname, 'en')}`}
      />

      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content="GEMBA IT" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:locale" content={LOCALE[lang] || 'en_US'} />
      {LANGS.filter((l) => l !== lang).map((l) => (
        <meta key={l} property="og:locale:alternate" content={LOCALE[l]} />
      ))}
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {post && (
        <>
          <meta property="article:published_time" content={post.date} />
          <meta property="article:author" content={post.author} />
          {(post.tags || []).map((tag) => (
            <meta key={tag} property="article:tag" content={tag} />
          ))}
        </>
      )}

      {jsonLd.map((data, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
}
