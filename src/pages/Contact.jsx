import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const TURNSTILE_SITEKEY = '0x4AAAAAAC9x5sdEMg3SCV04';

export default function Contact() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    const r = () => { if (window.turnstile && turnstileRef.current && widgetIdRef.current === null) { widgetIdRef.current = window.turnstile.render(turnstileRef.current, { sitekey: TURNSTILE_SITEKEY, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }); } };
    if (window.turnstile) r(); else { const iv = setInterval(() => { if (window.turnstile) { r(); clearInterval(iv); } }, 200); return () => clearInterval(iv); }
    return () => { if (widgetIdRef.current !== null && window.turnstile) { try { window.turnstile.remove(widgetIdRef.current); } catch(e) {} widgetIdRef.current = null; } };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSending(true); setStatus(null);
    try {
      const tk = window.turnstile?.getResponse(widgetIdRef.current);
      if (!tk) { setStatus('error'); setSending(false); return; }
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, turnstileToken: tk }) });
      if (!res.ok) throw new Error();
      setStatus('success'); setForm({ name: '', email: '', subject: '', message: '' });
      if (window.turnstile) window.turnstile.reset(widgetIdRef.current);
    } catch { setStatus('error'); } finally { setSending(false); }
  };

  const is = { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' };

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold mb-3 animate-fade-up" style={{ fontFamily: 'var(--font-display)' }}>{t('contact.title')}</h1>
      <p className="text-base mb-10 animate-fade-up delay-100" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{t('contact.subtitle')}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="animate-fade-up delay-200 space-y-5">
          <div><p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('contact.email_label')}</p><a href={`mailto:${t('contact.email')}`} className="text-sm font-medium no-underline" style={{ color: '#4F46E5' }}>{t('contact.email')}</a></div>
          <div><p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('contact.location_label')}</p><p className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('contact.location')}</p><p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('contact.operating')}</p></div>
          <div><p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>GEMBA Group</p><a href="https://gembateam.com" target="_blank" rel="noopener noreferrer" className="text-sm no-underline block" style={{ color: 'var(--text-secondary)' }}>gembateam.com ↗</a><a href="https://gembaindustrial.com" target="_blank" rel="noopener noreferrer" className="text-sm no-underline block mt-1" style={{ color: 'var(--text-secondary)' }}>Industrial Services ↗</a></div>
        </div>
        <div className="md:col-span-2 animate-fade-up delay-300">
          <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('contact.form.name')} *</label><input type="text" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={is}/></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('contact.form.email')} *</label><input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={is}/></div>
              </div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('contact.form.subject')}</label><input type="text" value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={is}/></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('contact.form.message')} *</label><textarea rows="5" required value={form.message} onChange={e=>setForm({...form,message:e.target.value})} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={is}/></div>
              {status === 'success' && <div className="text-sm font-medium px-4 py-3 rounded-lg" style={{ backgroundColor: 'rgba(5,150,105,0.08)', color: '#059669' }}>{t('contact.form.success')}</div>}
              {status === 'error' && <div className="text-sm font-medium px-4 py-3 rounded-lg" style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>{t('contact.form.error')}</div>}
              <div className="flex flex-col items-center gap-4 mt-6">
                <div ref={turnstileRef} />
                <button type="submit" disabled={sending} className="btn-flat primary text-sm" style={{ opacity: sending ? 0.6 : 1 }}>{sending ? t('contact.form.sending') : `${t('contact.form.send')} →`}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
