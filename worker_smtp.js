import { connect } from 'cloudflare:sockets';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration & Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SENDER = 'alerts@ibf.com.sa';
const DEFAULT_RECIPIENT = 'alerts@ibf.com.sa';
const SMTP_HOST = 'smtp.zoho.in';
const SMTP_PORT = 465;

const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function allowedOrigins(env) {
  return (env.FRONTEND_URL || 'https://ibf.com.sa,https://www.ibf.com.sa')
    .split(',')
    .map((v) => v.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (!origin) return headers;
  const normalized = origin.replace(/\/$/, '');
  if (DEV_ORIGIN.test(normalized) || allowedOrigins(env).includes(normalized)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function json(body, { status = 200, request, env } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request, env),
    },
  });
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeHeader(val, maxLen = 80) {
  if (!val) return '';
  return String(val).replace(/[\r\n]+/g, ' ').trim().slice(0, maxLen);
}

// ─────────────────────────────────────────────────────────────────────────────
// Zoho SMTP Socket Dispatcher (Direct TLS on Port 465)
// ─────────────────────────────────────────────────────────────────────────────

async function sendSmtpZoho({ subject, html, replyTo, env }) {
  const sender = env.SENDER_EMAIL || DEFAULT_SENDER;
  const recipient = env.RECIPIENT_EMAIL || DEFAULT_RECIPIENT;
  const password = env.SMTP_PASS || 'eXByvNATzLan';

  const socket = connect(
    { hostname: SMTP_HOST, port: SMTP_PORT },
    { secureTransport: 'on' }
  );

  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let buffer = '';

  async function readResponse() {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error('SMTP connection closed unexpectedly');
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\r\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3}\s/.test(lines[i])) {
          const code = parseInt(lines[i].substring(0, 3), 10);
          buffer = lines.slice(i + 1).join('\r\n');
          if (code >= 400) {
            throw new Error(`SMTP Error ${code}: ${lines[i]}`);
          }
          return code;
        }
      }
    }
  }

  async function writeCommand(cmd) {
    await writer.write(encoder.encode(cmd + '\r\n'));
  }

  try {
    // 1. Initial Greeting from Zoho
    await readResponse();

    // 2. EHLO
    await writeCommand('EHLO ibf.com.sa');
    await readResponse();

    // 3. AUTH PLAIN (\0user\0pass)
    const authString = `\0${sender}\0${password}`;
    const authBase64 = btoa(authString);
    await writeCommand(`AUTH PLAIN ${authBase64}`);
    await readResponse();

    // 4. MAIL FROM
    await writeCommand(`MAIL FROM:<${sender}>`);
    await readResponse();

    // 5. RCPT TO
    await writeCommand(`RCPT TO:<${recipient}>`);
    await readResponse();

    // 6. DATA
    await writeCommand('DATA');
    await readResponse();

    // 7. MIME Message Payload
    const msgId = `<${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ibf.com.sa>`;
    const dateStr = new Date().toUTCString();
    const encodedSubject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

    const mimeHeaderLines = [
      `Date: ${dateStr}`,
      `From: "IBF Website" <${sender}>`,
      `To: <${recipient}>`,
      replyTo ? `Reply-To: <${replyTo}>` : null,
      `Message-ID: ${msgId}`,
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      '',
      html,
      '.'
    ].filter((line) => line !== null);

    await writeCommand(mimeHeaderLines.join('\r\n'));
    await readResponse(); // 250 Message received

    // 8. QUIT
    await writeCommand('QUIT');
    try {
      await readResponse();
    } catch {}

    return { success: true, messageId: msgId };
  } finally {
    try { writer.releaseLock(); } catch {}
    try { reader.releaseLock(); } catch {}
    try { socket.close(); } catch {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Email Templates
// ─────────────────────────────────────────────────────────────────────────────

function renderContactEmail(formData) {
  const { fullName, email, companyName, phone, serviceTopic, message } = formData;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #0b1c3d; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
        📬 New Website Direct Inquiry
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr>
          <td style="padding: 8px; font-weight: bold; width: 35%; color: #555;">Full Name:</td>
          <td style="padding: 8px;">${esc(fullName) || 'N/A'}</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Business Email:</td>
          <td style="padding: 8px;"><a href="mailto:${esc(email)}">${esc(email)}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Company:</td>
          <td style="padding: 8px;">${esc(companyName) || 'N/A'}</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Phone Number:</td>
          <td style="padding: 8px;">${esc(phone) || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Service Topic:</td>
          <td style="padding: 8px; font-weight: bold; color: #0b1c3d;">${esc(serviceTopic) || 'N/A'}</td>
        </tr>
      </table>
      <div style="margin-top: 20px; padding: 15px; background-color: #f4f6f9; border-left: 4px solid #0b1c3d; border-radius: 4px;">
        <h4 style="margin-top: 0; color: #0b1c3d;">Message Details:</h4>
        <p style="white-space: pre-wrap; color: #333;">${esc(message) || 'No details provided.'}</p>
      </div>
      <p style="font-size: 12px; color: #888; margin-top: 25px; text-align: center;">
        This email was automatically dispatched from the IBF Website Contact Form via Zoho SMTP.
      </p>
    </div>
  `;
}

function renderRfqEmail(formData) {
  const {
    contactName,
    company,
    email,
    mobile,
    country,
    city,
    projectName,
    customerRfqRef,
    deliveryCountry,
    deliveryCity,
    submissionDeadline,
    requiredDeliveryDate,
    deliveryBasis,
    currency,
    deliveryAddress,
    approvedVendorListRequired,
    certificationRequirements,
    technicalNotes,
    commercialNotes,
  } = formData;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #0b1c3d; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
        📄 New Commercial RFQ Request
      </h2>

      <h3 style="color: #d4af37; margin-top: 20px; margin-bottom: 10px;">👤 Customer Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; font-weight: bold; width: 35%; color: #555;">Contact Name:</td>
          <td style="padding: 8px;">${esc(contactName) || 'N/A'}</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Company:</td>
          <td style="padding: 8px;"><strong>${esc(company) || 'N/A'}</strong></td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Email:</td>
          <td style="padding: 8px;"><a href="mailto:${esc(email)}">${esc(email)}</a></td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Mobile:</td>
          <td style="padding: 8px;">${esc(mobile) || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Location:</td>
          <td style="padding: 8px;">${city ? `${esc(city)}, ` : ''}${esc(country) || ''}</td>
        </tr>
      </table>

      <h3 style="color: #d4af37; margin-top: 25px; margin-bottom: 10px;">📋 Project Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; width: 35%; color: #555;">Project Name:</td>
          <td style="padding: 8px;">${esc(projectName) || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Customer RFQ Ref:</td>
          <td style="padding: 8px;">${esc(customerRfqRef) || 'N/A'}</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Delivery Location:</td>
          <td style="padding: 8px;">${deliveryCity ? `${esc(deliveryCity)}, ` : ''}${esc(deliveryCountry) || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Submission Deadline:</td>
          <td style="padding: 8px;">${esc(submissionDeadline) || 'N/A'}</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Required Delivery Date:</td>
          <td style="padding: 8px;">${esc(requiredDeliveryDate) || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Delivery Basis:</td>
          <td style="padding: 8px;">${esc(deliveryBasis) || 'NOT SPECIFIED'}</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Preferred Currency:</td>
          <td style="padding: 8px;">${esc(currency) || 'SAR'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Approved Vendor List (AVL) Required:</td>
          <td style="padding: 8px;">${approvedVendorListRequired ? '✅ Yes' : 'No'}</td>
        </tr>
      </table>

      ${deliveryAddress ? `
        <div style="margin-top: 15px; padding: 10px 15px; background-color: #f9f9f9; border-radius: 4px;">
          <strong>Delivery Address:</strong> ${esc(deliveryAddress)}
        </div>
      ` : ''}

      ${certificationRequirements ? `
        <div style="margin-top: 15px; padding: 10px 15px; background-color: #f9f9f9; border-radius: 4px;">
          <strong>Certification Requirements:</strong><br />${esc(certificationRequirements)}
        </div>
      ` : ''}

      ${technicalNotes ? `
        <div style="margin-top: 15px; padding: 12px 15px; background-color: #f4f6f9; border-left: 4px solid #0b1c3d; border-radius: 4px;">
          <strong style="color: #0b1c3d;">Technical Notes &amp; Specifications:</strong><br />
          <p style="white-space: pre-wrap; margin-top: 5px; color: #333;">${esc(technicalNotes)}</p>
        </div>
      ` : ''}

      ${commercialNotes ? `
        <div style="margin-top: 15px; padding: 12px 15px; background-color: #fff9e6; border-left: 4px solid #d4af37; border-radius: 4px;">
          <strong style="color: #b8860b;">Commercial Notes &amp; Payment Terms:</strong><br />
          <p style="white-space: pre-wrap; margin-top: 5px; color: #333;">${esc(commercialNotes)}</p>
        </div>
      ` : ''}

      <p style="font-size: 12px; color: #888; margin-top: 25px; text-align: center;">
        This RFQ email was automatically dispatched from the IBF Website Request a Quote Desk via Zoho SMTP.
      </p>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function readJsonBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

async function handleContact(request, env) {
  const formData = await readJsonBody(request);
  if (!formData) {
    return json({ success: false, message: 'Invalid JSON body.' }, { status: 400, request, env });
  }
  if (!formData.email || !formData.message) {
    return json({ success: false, message: 'Email and message are required.' }, { status: 400, request, env });
  }

  try {
    const topic = sanitizeHeader(formData.serviceTopic, 60) || 'Inquiry';
    const who = sanitizeHeader(formData.fullName, 60) || sanitizeHeader(formData.email, 60);
    const subject = `[IBF Contact] ${topic} - ${who}`;

    const result = await sendSmtpZoho({
      subject,
      html: renderContactEmail(formData),
      replyTo: formData.email,
      env,
    });

    const recipient = env.RECIPIENT_EMAIL || DEFAULT_RECIPIENT;
    return json(
      { success: true, message: `Message dispatched successfully to ${recipient}`, messageId: result.messageId },
      { status: 200, request, env }
    );
  } catch (error) {
    console.error('Error sending Contact email:', error?.stack || error);
    return json(
      { success: false, message: 'Failed to send email. Please try again or email us directly.', error: String(error?.message || error) },
      { status: 502, request, env }
    );
  }
}

async function handleRfq(request, env) {
  const formData = await readJsonBody(request);
  if (!formData) {
    return json({ success: false, message: 'Invalid JSON body.' }, { status: 400, request, env });
  }
  if (!formData.email || !formData.contactName || !formData.company) {
    return json({ success: false, message: 'Contact name, company, and email are required.' }, { status: 400, request, env });
  }

  try {
    const who = sanitizeHeader(formData.company, 80) || sanitizeHeader(formData.contactName, 80) || sanitizeHeader(formData.email, 80);
    const subject = `[IBF RFQ] Request from ${who}`;

    const result = await sendSmtpZoho({
      subject,
      html: renderRfqEmail(formData),
      replyTo: formData.email,
      env,
    });

    const recipient = env.RECIPIENT_EMAIL || DEFAULT_RECIPIENT;
    return json(
      { success: true, message: `RFQ request dispatched successfully to ${recipient}`, messageId: result.messageId },
      { status: 200, request, env }
    );
  } catch (error) {
    console.error('Error sending RFQ email:', error?.stack || error);
    return json(
      { success: false, message: 'Failed to send RFQ email. Please try again or email us directly.', error: String(error?.message || error) },
      { status: 502, request, env }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Export (Fetch Handler)
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const rawPath = new URL(request.url).pathname;
    const pathname = rawPath.replace(/\/+/g, '/');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (pathname === '/api/health' && request.method === 'GET') {
      return json({ status: 'ok', message: 'IBF Zoho SMTP Worker is running' }, { request, env });
    }

    if (pathname === '/api/contact' && request.method === 'POST') {
      return handleContact(request, env);
    }

    if (pathname === '/api/request-quote' && request.method === 'POST') {
      return handleRfq(request, env);
    }

    return json({ success: false, message: 'Not found.' }, { status: 404, request, env });
  },
};
