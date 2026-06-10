import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import posts from '../../content/blog/posts.json';

const tagColors = {
  payments: { bg: 'rgba(16,185,129,0.1)', color: '#059669' },
  fintech: { bg: 'rgba(79,70,229,0.1)', color: '#4F46E5' },
  gembapay: { bg: 'rgba(6,182,212,0.1)', color: '#0E7490' },
  devops: { bg: 'rgba(245,158,11,0.1)', color: '#D97706' },
  infrastructure: { bg: 'rgba(107,114,128,0.1)', color: '#4B5563' },
  hetzner: { bg: 'rgba(99,102,241,0.1)', color: '#6366F1' },
  web3: { bg: 'rgba(139,92,246,0.1)', color: '#7C3AED' },
  blockchain: { bg: 'rgba(139,92,246,0.1)', color: '#7C3AED' },
  business: { bg: 'rgba(6,182,212,0.1)', color: '#0E7490' },
};

export default function Blog() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const sortedPosts = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1
        className="text-3xl sm:text-4xl font-bold mb-3 animate-fade-up"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('blog.page_title')}
      </h1>
      <p
        className="text-base mb-10 animate-fade-up delay-100"
        style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}
      >
        {lang === 'bg' ? 'Мисли за технологии, практики за разработка и еволюцията на дигиталния свят.' :
         lang === 'es' ? 'Reflexiones sobre tecnología, prácticas de desarrollo y la evolución del mundo digital.' :
         'Thoughts on technology, development practices, and the evolving digital landscape.'}
      </p>

      <div className="space-y-4">
        {sortedPosts.map((post, i) => (
          <Link
            key={post.slug}
            to={`/${lang}/blog/${post.slug}`}
            className="block rounded-xl p-5 no-underline transition-all duration-200 hover:-translate-y-0.5 animate-fade-up"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              animationDelay: `${0.1 + i * 0.05}s`,
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <time
                className="text-xs"
                style={{ color: 'var(--text-tertiary)' }}
                dateTime={post.date}
              >
                {new Date(post.date).toLocaleDateString(
                  lang === 'bg' ? 'bg-BG' : lang === 'es' ? 'es-ES' : 'en-US',
                  { year: 'numeric', month: 'long', day: 'numeric' }
                )}
              </time>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>·</span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{post.author}</span>
            </div>

            <h2
              className="text-lg font-semibold mb-2"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              {post.title[lang] || post.title.en}
            </h2>

            <p
              className="text-sm mb-3"
              style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}
            >
              {post.excerpt[lang] || post.excerpt.en}
            </p>

            <div className="flex flex-wrap gap-1.5">
              {post.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: tagColors[tag]?.bg || 'var(--bg-secondary)',
                    color: tagColors[tag]?.color || 'var(--text-secondary)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
