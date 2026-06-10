import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const TURNSTILE_SITEKEY = '0x4AAAAAAC9x5sdEMg3SCV04';
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.oasis.opendocument.text',
];

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Careers() {
  const { t } = useTranslation();
  const [cvForm, setCvForm] = useState({ name: '', email: '', message: '' });
  const [cvFile, setCvFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [cvSending, setCvSending] = useState(false);
  const [cvStatus, setCvStatus] = useState(null);
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const r = () => { if (window.turnstile && turnstileRef.current && widgetIdRef.current === null) { widgetIdRef.current = window.turnstile.render(turnstileRef.current, { sitekey: TURNSTILE_SITEKEY, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }); } };
    if (window.turnstile) r(); else { const iv = setInterval(() => { if (window.turnstile) { r(); clearInterval(iv); } }, 200); return () => clearInterval(iv); }
    return () => { if (widgetIdRef.current !== null && window.turnstile) { try { window.turnstile.remove(widgetIdRef.current); } catch(e) {} widgetIdRef.current = null; } };
  }, []);

  const validateFile = (file) => {
    if (!file) return null;
    if (file.size > MAX_FILE_SIZE) return t('careers.fileTooLarge');
    if (!ALLOWED_TYPES.includes(file.type)) return t('careers.fileTypeInvalid');
    return null;
  };

  const handleFileChange = (file) => {
    if (!file) { setCvFile(null); setFileError(null); return; }
    const err = validateFile(file);
    if (err) { setFileError(err); setCvFile(null); return; }
    setFileError(null);
    setCvFile(file);
  };

  const onFileInput = (e) => handleFileChange(e.target.files?.[0] || null);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileChange(e.dataTransfer.files?.[0] || null);
  };

  const handleCvSubmit = async (e) => {
    e.preventDefault(); setCvSending(true); setCvStatus(null);
    try {
      const tk = window.turnstile?.getResponse(widgetIdRef.current);
      if (!tk) { setCvStatus('error'); setCvSending(false); return; }
      const fd = new FormData();
      fd.append('name', cvForm.name);
      fd.append('email', cvForm.email);
      fd.append('message', cvForm.message);
      fd.append('turnstileToken', tk);
      if (cvFile) fd.append('cv', cvFile);
      const res = await fetch('/api/career', { method: 'POST', body: fd });
      if (!res.ok) throw new Error();
      setCvStatus('success');
      setCvForm({ name: '', email: '', message: '' });
      setCvFile(null);
      setFileError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (window.turnstile) window.turnstile.reset(widgetIdRef.current);
    } catch { setCvStatus('error'); } finally { setCvSending(false); }
  };

  const is = { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' };

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold mb-3 animate-fade-up" style={{ fontFamily: 'var(--font-display)' }}>{t('careers.intro_title')}</h1>
      <p className="text-base mb-10 animate-fade-up delay-100" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{t('careers.intro')}</p>
      <div className="animate-fade-up delay-200">
        <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-display)' }}>{t('careers.open_positions')}</h2>
        <div className="rounded-xl p-6 mb-8" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{t('careers.marketing_title')}</h3>
            <span className="text-xs px-3 py-1 rounded-full shrink-0" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>Remote</span>
          </div>
          <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{t('careers.marketing_desc')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t('careers.we_need')}</h4>
              <ul className="space-y-1.5">{t('careers.needs',{returnObjects:true}).map((n,i)=><li key={i} className="text-sm flex items-start gap-2" style={{color:'var(--text-secondary)'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>{n}</li>)}</ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t('careers.we_offer')}</h4>
              <ul className="space-y-1.5">{t('careers.offers',{returnObjects:true}).map((o,i)=><li key={i} className="text-sm flex items-start gap-2" style={{color:'var(--text-secondary)'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>{o}</li>)}</ul>
            </div>
          </div>
          <div className="mt-5"><a href="#cv-form" className="btn-flat primary text-sm">{t('careers.apply')} →</a></div>
        </div>
      </div>
      <div id="cv-form" className="animate-fade-up delay-300">
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
          <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t('careers.no_role_title')}</h3>
          <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{t('careers.no_role')}</p>
          <form onSubmit={handleCvSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium mb-1.5" style={{color:'var(--text-secondary)'}}>{t('contact.form.name')} *</label><input type="text" required value={cvForm.name} onChange={e=>setCvForm({...cvForm,name:e.target.value})} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={is}/></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{color:'var(--text-secondary)'}}>{t('contact.form.email')} *</label><input type="email" required value={cvForm.email} onChange={e=>setCvForm({...cvForm,email:e.target.value})} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={is}/></div>
            </div>
            <div><label className="block text-xs font-medium mb-1.5" style={{color:'var(--text-secondary)'}}>{t('contact.form.message')}</label><textarea rows="4" value={cvForm.message} onChange={e=>setCvForm({...cvForm,message:e.target.value})} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={is}/></div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{color:'var(--text-secondary)'}}>{t('careers.cvLabel')}</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/vnd.oasis.opendocument.text"
                onChange={onFileInput}
                style={{ display: 'none' }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                className="rounded-lg text-center cursor-pointer transition-colors"
                style={{
                  border: '1px dashed var(--border-color)',
                  backgroundColor: dragOver ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  padding: '24px',
                }}
              >
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '4px' }}>
                  <span style={{ marginRight: '6px' }}>📎</span>
                  {t('careers.cvPrompt')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{t('careers.cvAccept')}</div>
              </div>
              {cvFile && (
                <div className="mt-2 flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {t('careers.fileAttached')} <strong>{cvFile.name}</strong> — {formatSize(cvFile.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setCvFile(null); setFileError(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    aria-label="Remove file"
                    style={{ color: 'var(--text-tertiary)', fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
                  >
                    ✕
                  </button>
                </div>
              )}
              {fileError && (
                <div className="mt-2 text-xs" style={{ color: '#DC2626' }}>{fileError}</div>
              )}
            </div>

            {cvStatus==='success'&&<div className="text-sm font-medium px-4 py-3 rounded-lg" style={{backgroundColor:'rgba(5,150,105,0.08)',color:'#059669'}}>{t('contact.form.success')}</div>}
            {cvStatus==='error'&&<div className="text-sm font-medium px-4 py-3 rounded-lg" style={{backgroundColor:'rgba(220,38,38,0.08)',color:'#DC2626'}}>{t('contact.form.error')}</div>}

            <div className="flex flex-col items-center gap-4 mt-6">
              <div ref={turnstileRef} />
              <button type="submit" disabled={cvSending} className="btn-flat primary text-sm" style={{opacity:cvSending?0.6:1}}>
                {cvSending ? t('contact.form.sending') : `${t('careers.send_cv')} →`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
