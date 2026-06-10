const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const app = express();

const CV_ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.oasis.opendocument.text',
];

const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (CV_ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  },
});

const PORT = process.env.PORT || 3082;
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
const SMTP_HOST = process.env.SMTP_HOST || 'mail.gembamail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'GEMBA IT Studio';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL;
const SITE_NAME = process.env.SITE_NAME || 'Website';

app.use(express.json({ limit: '1mb' }));

// Rate limiting (simple in-memory)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // max 5 submissions per hour per IP

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return true;
  }
  if (now - record.firstRequest > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

// Clean up rate limit map every hour
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap) {
    if (now - record.firstRequest > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

// Verify Turnstile token
async function verifyTurnstile(token, ip) {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET,
        response: token,
        remoteip: ip,
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return false;
  }
}

// Create SMTP transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  requireTLS: !SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
});

// Verify SMTP connection on startup
transporter.verify((err) => {
  if (err) {
    console.error('SMTP connection error:', err.message);
    console.log('Contact form emails will fail until SMTP is configured correctly.');
  } else {
    console.log('SMTP connection verified successfully.');
  }
});

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Rate limit
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { name, email, subject, message, turnstileToken } = req.body;

  // Validate required fields
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  // Verify Turnstile
  if (!turnstileToken) {
    return res.status(400).json({ error: 'Turnstile verification required.' });
  }

  const turnstileValid = await verifyTurnstile(turnstileToken, ip);
  if (!turnstileValid) {
    return res.status(403).json({ error: 'Turnstile verification failed.' });
  }

  // Send email
  try {
    await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: subject ? `[Contact Form] ${subject}` : `[Contact Form] Message from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #4F46E5;">New Contact — GEMBA IT</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #666; width: 100px;">Name:</td>
              <td style="padding: 8px;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #666;">Email:</td>
              <td style="padding: 8px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
            </tr>
            ${subject ? `<tr>
              <td style="padding: 8px; font-weight: bold; color: #666;">Subject:</td>
              <td style="padding: 8px;">${escapeHtml(subject)}</td>
            </tr>` : ''}
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
          </div>
          <p style="margin-top: 16px; font-size: 12px; color: #999;">
            Sent from gembait.com contact form · IP: ${ip}
          </p>
        </div>
      `,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// CV / Career form endpoint — accepts multipart/form-data with optional CV file
app.post('/api/career', (req, res, next) => {
  cvUpload.single('cv')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 8MB)' : err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    return handleCareer(req, res, next);
  });
});

async function handleCareer(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { name, email, message, turnstileToken } = req.body;
  const cv = req.file;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  if (!turnstileToken) {
    return res.status(400).json({ error: 'Turnstile verification required.' });
  }

  const turnstileValid = await verifyTurnstile(turnstileToken, ip);
  if (!turnstileValid) {
    return res.status(403).json({ error: 'Turnstile verification failed.' });
  }

  const attachments = cv ? [{
    filename: cv.originalname,
    content: cv.buffer,
    contentType: cv.mimetype,
  }] : [];

  try {
    await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `[Career Application] ${name}${cv ? ' — with CV' : ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #06B6D4;">New Career Application — GEMBA IT</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #666; width: 100px;">Name:</td>
              <td style="padding: 8px;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #666;">Email:</td>
              <td style="padding: 8px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
            </tr>
            ${cv ? `<tr>
              <td style="padding: 8px; font-weight: bold; color: #666;">CV:</td>
              <td style="padding: 8px;">${escapeHtml(cv.originalname)} (${(cv.size / 1024).toFixed(1)} KB)</td>
            </tr>` : ''}
          </table>
          ${message ? `<div style="margin-top: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
          </div>` : ''}
          <p style="margin-top: 16px; font-size: 12px; color: #999;">
            Sent from gembait.com careers form · IP: ${ip}
          </p>
        </div>
      `,
      attachments,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: 'Failed to send application. Please try again.' });
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Backend API running on port ${PORT}`);
});
