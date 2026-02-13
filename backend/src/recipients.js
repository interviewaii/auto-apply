const fs = require("fs");
const { parse } = require("csv-parse/sync");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  // Good-enough validation for automation; avoids obvious junk.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function loadRecipients(csvPath) {
  const raw = fs.readFileSync(csvPath, "utf8");
  let recipients = [];

  // Preferred format: CSV with header row "email,name"
  try {
    const records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    for (const r of records) {
      const email = normalizeEmail(r.email || r.Email || r.EMAIL);
      if (!email) continue;
      if (!isValidEmail(email)) continue;
      const name = String(r.name || r.Name || r.NAME || "").trim();
      recipients.push({ email, name });
    }
  } catch {
    // fall through to headerless parsing
  }

  // If header parsing produced 0 rows, support headerless formats:
  // - "someone@x.com,Name"
  // - "someone@x.com"
  if (recipients.length === 0) {
    const rows = parse(raw, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
    });
    for (const row of rows) {
      const email = normalizeEmail(row?.[0]);
      if (!email) continue;
      if (!isValidEmail(email)) continue;
      const name = String(row?.[1] || "").trim();
      recipients.push({ email, name });
    }
  }

  // De-dupe by email (keep first name if present)
  const seen = new Map();
  for (const r of recipients) {
    if (!seen.has(r.email)) {
      seen.set(r.email, r);
      continue;
    }
    const existing = seen.get(r.email);
    if (!existing.name && r.name) existing.name = r.name;
  }
  return Array.from(seen.values());
}

module.exports = { loadRecipients, normalizeEmail, isValidEmail };


