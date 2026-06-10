import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export default function ServiceModal({ service, onClose }) {
  const { t } = useTranslation();
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);
  const lastFocusRef = useRef(null);

  useEffect(() => {
    if (!service) return undefined;

    lastFocusRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 0);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      clearTimeout(focusTimer);
      if (lastFocusRef.current && typeof lastFocusRef.current.focus === 'function') {
        lastFocusRef.current.focus();
      }
    };
  }, [service, onClose]);

  if (!service) return null;

  const detail = service.detail || {};
  const labels = t('services.modal', { returnObjects: true });

  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onBackdropClick}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-modal-title"
      >
        <div className="modal-panel-header">
          <h2
            id="service-modal-title"
            className="text-2xl sm:text-3xl font-bold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            {service.title}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="modal-close-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-panel-body">
          {detail.summary && (
            <p
              className="text-base mb-6"
              style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}
            >
              {detail.summary}
            </p>
          )}

          {detail.image && (
            <img
              src={detail.image}
              alt={service.title}
              loading="lazy"
              style={{
                width: '100%',
                aspectRatio: '16 / 9',
                objectFit: 'cover',
                borderRadius: '12px',
                marginBottom: '24px',
                display: 'block',
              }}
            />
          )}

          {Array.isArray(detail.whatItIncludes) && detail.whatItIncludes.length > 0 && (
            <>
              <div className="modal-divider" />
              <div className="modal-section-label">{labels.whatItIncludes}</div>
              <ul className="modal-bullet-list">
                {detail.whatItIncludes.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {detail.whenYouNeedIt && (
            <>
              <div className="modal-divider" />
              <div className="modal-section-label">{labels.whenYouNeedIt}</div>
              <p className="text-base" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {detail.whenYouNeedIt}
              </p>
            </>
          )}

          {detail.howWeWork && (
            <>
              <div className="modal-divider" />
              <div className="modal-section-label">{labels.howWeWork}</div>
              <p className="text-base" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {detail.howWeWork}
              </p>
            </>
          )}

          {detail.outcome && (
            <>
              <div className="modal-divider" />
              <div className="modal-section-label">{labels.outcome}</div>
              <p className="text-base" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {detail.outcome}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
