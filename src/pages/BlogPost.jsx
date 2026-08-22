import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { marked } from 'marked';
import posts from '../../content/blog/posts.json';

// Strip a leading YAML frontmatter block (--- ... ---) so it never renders as text.
// Post metadata comes from posts.json, so the .md frontmatter is redundant.
const stripFrontmatter = (md) => (md || '').replace(/^﻿?\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Eagerly-imported JSON schema sidecars (shape: { articleSchema, faqSchema }).
// Vite bundles them at build time; missing sidecars are a safe no-op.
const schemaModules = import.meta.glob('/content/blog/*.schema.json', { eager: true });

export default function BlogPost() {
  const { slug, lang } = useParams();
  const { i18n } = useTranslation();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  const post = posts.find(p => p.slug === slug);
  const currentLang = lang || i18n.language || 'en';

  const schemaKey = `/content/blog/${slug}.schema.json`;
  const schemaSidecar = schemaModules[schemaKey]?.default || schemaModules[schemaKey] || null;

  useEffect(() => {
    if (!post) {
      setLoading(false);
      return;
    }

    // Try to load markdown for current language, fallback to English
    const loadContent = async () => {
      setLoading(true);
      try {
        // Dynamic import of markdown files
        const modules = import.meta.glob('/content/blog/*.{en,bg,es}.md', { query: '?raw', import: 'default' });
        const path = `/content/blog/${slug}.${currentLang}.md`;
        const fallbackPath = `/content/blog/${slug}.en.md`;

        let md = '';
        if (modules[path]) {
          md = await modules[path]();
        } else if (modules[fallbackPath]) {
          md = await modules[fallbackPath]();
        }

        setContent(stripFrontmatter(md));
      } catch (err) {
        console.error('Failed to load blog post:', err);
        setContent('');
      }
      setLoading(false);
    };

    loadContent();
  }, [slug, currentLang, post]);

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          Post not found
        </h1>
        <Link to={`/${currentLang}/blog`} className="btn-flat primary text-sm">
          ← Back to blog
        </Link>
      </div>
    );
  }

  const title = post.title[currentLang] || post.title.en;

  return (
    <>
      <Helmet>
        <title>{`${title} — GEMBA IT Blog`}</title>
        <meta name="description" content={post.excerpt?.[currentLang] || post.excerpt?.en || ''} />
        <meta property="og:title" content={title} />
        <meta property="og:type" content="article" />
        {post.hero && <meta property="og:image" content={`https://gembait.com${post.hero}`} />}
        {schemaSidecar?.articleSchema && (
          <script type="application/ld+json">
            {JSON.stringify(schemaSidecar.articleSchema)}
          </script>
        )}
        {schemaSidecar?.faqSchema && (
          <script type="application/ld+json">
            {JSON.stringify(schemaSidecar.faqSchema)}
          </script>
        )}
      </Helmet>
      <article className="max-w-3xl mx-auto px-4 py-16">
        {/* Back link */}
        <Link
          to={`/${currentLang}/blog`}
          className="inline-flex items-center gap-1 text-sm font-medium no-underline mb-8 animate-fade-up"
          style={{ color: 'var(--text-secondary)' }}
        >
          ← {currentLang === 'bg' ? 'Към блога' : currentLang === 'es' ? 'Volver al blog' : 'Back to blog'}
        </Link>

        {/* Header — date, title, tags FIRST (then hero, then body). */}
        <header className="mb-6 animate-fade-up delay-100">
          <div className="flex items-center gap-3 mb-3">
            <time
              className="text-sm"
              style={{ color: 'var(--text-tertiary)' }}
              dateTime={post.date}
            >
              {new Date(post.date).toLocaleDateString(
                currentLang === 'bg' ? 'bg-BG' : currentLang === 'es' ? 'es-ES' : 'en-US',
                { year: 'numeric', month: 'long', day: 'numeric' }
              )}
            </time>
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>·</span>
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{post.author}</span>
          </div>

          <h1
            className="text-2xl sm:text-3xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-display)', lineHeight: 1.3 }}
          >
            {title}
          </h1>

          <div className="flex flex-wrap gap-1.5">
            {post.tags.map(tag => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        </header>

        {/* Hero image — placed under tags (per 2-image layout). */}
        {post.hero && (
          <picture className="block mb-8 animate-fade-up delay-150">
            <source
              srcSet={`${post.hero} 1x${post.heroRetina ? `, ${post.heroRetina} 2x` : ''}`}
              type="image/webp"
            />
            <img
              src={post.hero}
              alt={`Visual concept for: ${title}`}
              loading="eager"
              width={1200}
              height={630}
              className="w-full h-auto rounded-lg"
              style={{ aspectRatio: '1200 / 630', objectFit: 'cover' }}
            />
          </picture>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div
              className="inline-block w-6 h-6 rounded-full animate-spin"
              style={{ border: '2px solid var(--border-color)', borderTopColor: '#4F46E5' }}
            />
          </div>
        ) : content ? (
          <div
            className="blog-content animate-fade-up delay-200"
            dangerouslySetInnerHTML={{ __html: marked(content) }}
          />
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>
            {currentLang === 'bg' ? 'Съдържанието не е налично на този език.' :
             currentLang === 'es' ? 'El contenido no está disponible en este idioma.' :
             'Content not available in this language.'}
          </p>
        )}

        {/* Footer */}
        <div
          className="mt-12 pt-8 flex justify-between items-center"
          style={{ borderTop: '1px solid var(--border-color)' }}
        >
          <Link
            to={`/${currentLang}/blog`}
            className="text-sm font-medium no-underline"
            style={{ color: '#4F46E5' }}
          >
            ← {currentLang === 'bg' ? 'Всички статии' : currentLang === 'es' ? 'Todos los artículos' : 'All posts'}
          </Link>
          <Link
            to={`/${currentLang}/contact`}
            className="text-sm font-medium no-underline"
            style={{ color: '#4F46E5' }}
          >
            {currentLang === 'bg' ? 'Свържете се с нас' : currentLang === 'es' ? 'Contáctanos' : 'Get in touch'} →
          </Link>
        </div>
      </article>
    </>
  );
}
