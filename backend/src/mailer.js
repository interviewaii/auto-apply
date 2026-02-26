const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const { buildEmail } = require("./template");

function assertSmtpConfig(smtp) {
  const missing = [];
  if (!smtp.host) missing.push("SMTP_HOST");
  if (!smtp.port) missing.push("SMTP_PORT");
  if (!smtp.user) missing.push("SMTP_USER");
  if (!smtp.pass) missing.push("SMTP_PASS");
  if (missing.length) {
    throw new Error(`Missing SMTP config: ${missing.join(", ")} (set these in .env)`);
  }
}

function isReachabilityError(err) {
  const code = String(err?.code || "").toUpperCase();
  return [
    "ENETUNREACH",
    "EHOSTUNREACH",
    "ENETDOWN",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
  ].includes(code);
}

function formatEndpoint(smtp) {
  return `${smtp.host}:${smtp.port} (secure=${smtp.secure ? "true" : "false"})`;
}

function createNodeMailerTransport({ smtp }) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

/**
 * Sends email via Brevo HTTP API (Rest API over Port 443)
 */
async function sendViaBrevoAPI({ apiKey, from, to, toName, subject, text, html, attachments, mailOptions }) {
  console.log(`[brevo-api] Attempting HTTP fallback for ${to}... (Sender: ${from.email})`);

  const brevoAttachments = (attachments || []).map(a => {
    if (a.path && fs.existsSync(a.path)) {
      try {
        return {
          content: fs.readFileSync(a.path).toString("base64"),
          name: a.filename || path.basename(a.path)
        };
      } catch (e) {
        console.error(`[brevo-api] Failed to read attachment ${a.path}:`, e);
        return null;
      }
    }
    return null;
  }).filter(Boolean);

  const payload = {
    sender: { name: from.name || "Hiring Team", email: from.email },
    to: [{ email: to, name: toName || "" }],
    subject: subject,
    htmlContent: html,
    textContent: text,
  };

  // Inject tracking pixel into HTML if trackingId and trackingBaseUrl are provided
  if (html && mailOptions?.trackingId && mailOptions?.trackingBaseUrl) {
    const trackingUrl = `${mailOptions.trackingBaseUrl}/api/track/${mailOptions.trackingId}`;
    payload.htmlContent = html + `<img src="${trackingUrl}" width="1" height="1" style="display:none;" />`;
  }

  if (brevoAttachments.length) {
    payload.attachment = brevoAttachments;
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": apiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok) {
    console.error("[brevo-api] HTTP Fallback Failed:", result);
    throw new Error(`Brevo API Error: ${result.message || response.statusText}`);
  }
  console.log(`[brevo-api] HTTP Fallback Success! Message IDs: ${JSON.stringify(result.messageIds || result)}`);
  return result;
}

async function createTransporter({ smtp, from }) {
  assertSmtpConfig(smtp);
  if (!from?.email) throw new Error("Missing FROM_EMAIL (or SMTP_USER) in .env");

  const primary = createNodeMailerTransport({ smtp });

  // Return a wrapper that has sendMail and handle fallback
  return {
    sendMail: async (mailOptions) => {
      try {
        // Try original SMTP
        return await primary.sendMail(mailOptions);
      } catch (err) {
        const isBrevo = smtp.host && smtp.host.includes("brevo.com");
        const errStr = String(err?.message || "").toLowerCase();
        const isNetworkErr = isReachabilityError(err) || errStr.includes("timeout") || errStr.includes("connection");

        if (isBrevo && isNetworkErr) {
          return await sendViaBrevoAPI({
            apiKey: smtp.pass,
            from,
            to: mailOptions.to,
            toName: mailOptions.toName, // Custom field passed from sendApplicationEmail
            subject: mailOptions.subject,
            text: mailOptions.text,
            html: mailOptions.html,
            attachments: mailOptions.attachments,
            mailOptions: mailOptions // Pass original options for trackingId
          });
        }
        throw err;
      }
    },
    verify: async () => {
      // For verify, if it's Brevo we might just return true since the API is always "up"
      try {
        return await primary.verify();
      } catch (err) {
        if (smtp.host && smtp.host.includes("brevo.com") && isReachabilityError(err)) {
          console.warn("[smtp] Brevo SMTP port blocked, but will use HTTP API fallback.");
          return true;
        }
        throw err;
      }
    }
  };
}

async function sendApplicationEmail({
  transporter,
  from,
  toEmail,
  toName,
  subject,
  resumePath,
  trackingId,
  trackingBaseUrl,
}) {
  const { text, html } = buildEmail({
    recipientName: toName,
    recipientEmail: toEmail,
    subject,
  });

  const attachments = [];
  if (resumePath) {
    const abs = path.resolve(resumePath);
    if (fs.existsSync(abs)) {
      attachments.push({
        filename: path.basename(abs),
        path: abs,
      });
    } else {
      console.warn(`[mailer] Resume not found at ${abs} — sending email without attachment.`);
    }
  }

  let finalHtml = html;
  if (trackingId && trackingBaseUrl) {
    const trackingUrl = `${trackingBaseUrl}/api/track/${trackingId}`;
    finalHtml += `<img src="${trackingUrl}" width="1" height="1" style="display:none;" />`;
  }

  return await transporter.sendMail({
    from: from.name ? `"${from.name}" <${from.email}>` : from.email,
    to: toEmail,
    toName,
    subject,
    text,
    html: finalHtml,
    attachments,
    trackingId, // Pass through to transporter for Brevo fallback if needed
    trackingBaseUrl,
  });
}

module.exports = { createTransporter, sendApplicationEmail };


