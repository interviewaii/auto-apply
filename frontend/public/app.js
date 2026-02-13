const $ = (sel) => document.querySelector(sel);

const form = $("#sendForm");
const statusEl = $("#status");
const sendBtn = $("#sendBtn");
const spinner = $(".btnSpinner");
const resetBtn = $("#resetBtn");
const subjectInput = $("#subject");
const bodyInput = $("#body");

const dropzone = $("#dropzone");
const resumeInput = $("#resume");
const filePill = $("#filePill");
const fileName = $("#fileName");
const clearFile = $("#clearFile");

const excelInput = $("#excel");
const bulkResumeInput = $("#bulkResume");
const bulkSendBtn = $("#bulkSendBtn");
const logoutBtn = $("#logoutBtn");
const bulkModeSel = $("#bulkMode");
const bulkExcelWrap = $("#bulkExcelWrap");
const bulkPasteWrap = $("#bulkPasteWrap");
const bulkEmailsTa = $("#bulkEmails");

// Tabs
const tabSend = $("#tabSend");
const tabAts = $("#tabAts");
const tabAuto = $("#tabAuto");
const tabDefaults = $("#tabDefaults");
const panelSend = $("#panelSend");
const panelAts = $("#panelAts");
const panelHr = $("#panelHr");
const panelAuto = $("#panelAuto");
const panelDefaults = $("#panelDefaults");
const panelSide = $("#panelSide");

// HR finder
const hrSearchBtn = $("#hrSearchBtn");
const hrResults = $("#hrResults");
const providerSel = $("#provider");
let lastHrContacts = [];
let lastHrPhone = "";

const companyInput = $("#company");
const companyDropdown = $("#companyDropdown");
const domainInput = $("#domain");

function debounce(fn, waitMs) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), waitMs);
  };
}

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const x of Array.isArray(arr) ? arr : []) {
    const s = String(x || "").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

let savedCompanyNames = [];
let liveCompanyNames = [];
let taActiveIndex = -1;

function getAllCompanyNames() {
  return uniqStrings([...(savedCompanyNames || []), ...(liveCompanyNames || [])]);
}

function ensureDropdownShell() {
  if (!companyDropdown) return null;
  // Use an inner wrapper so we can keep borders fixed while list scrolls.
  if (!companyDropdown.querySelector(".typeaheadMenuInner")) {
    companyDropdown.innerHTML = `<div class="typeaheadMenuInner"></div><div class="typeaheadMeta">Type to search, or pick a company.</div>`;
  }
  return companyDropdown.querySelector(".typeaheadMenuInner");
}

function closeCompanyDropdown() {
  if (!companyDropdown) return;
  companyDropdown.classList.add("hidden");
  taActiveIndex = -1;
}

function openCompanyDropdown() {
  if (!companyDropdown) return;
  companyDropdown.classList.remove("hidden");
}

function setActiveItem(idx) {
  const inner = ensureDropdownShell();
  if (!inner) return;
  const items = Array.from(inner.querySelectorAll(".typeaheadItem"));
  if (!items.length) {
    taActiveIndex = -1;
    return;
  }
  taActiveIndex = Math.max(0, Math.min(idx, items.length - 1));
  items.forEach((el, i) => el.classList.toggle("active", i === taActiveIndex));
  const active = items[taActiveIndex];
  if (active) active.scrollIntoView({ block: "nearest" });
}

function commitCompanyValue(v) {
  if (!companyInput) return;
  companyInput.value = String(v || "");
  closeCompanyDropdown();
}

function renderCompanyDropdown({ forceOpen = false } = {}) {
  if (!companyDropdown) return;
  const inner = ensureDropdownShell();
  if (!inner) return;

  const q = String(companyInput?.value || "").trim().toLowerCase();
  const all = getAllCompanyNames();
  const filtered = q
    ? all.filter((n) => String(n).toLowerCase().includes(q))
    : all;

  const shown = filtered.slice(0, 80);

  if (!shown.length) {
    inner.innerHTML = `<div class="typeaheadMeta" style="border-top:none;background:transparent;padding:10px 10px">No matches. Keep typing to use a custom name.</div>`;
    taActiveIndex = -1;
  } else {
    inner.innerHTML = shown
      .map(
        (name) =>
          `<button type="button" class="typeaheadItem" role="option" data-value="${escapeHtml(
            name,
          )}">${escapeHtml(name)}</button>`,
      )
      .join("");
    taActiveIndex = -1;
  }

  // Open only when focusing/typing.
  if (forceOpen) openCompanyDropdown();
}

async function loadSavedCompanyNames() {
  try {
    const res = await fetch("/api/company-names");
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return;
    savedCompanyNames = uniqStrings(data.companies || []);
    renderCompanyDropdown();
  } catch {
    // ignore
  }
}

const fetchCompanySuggestDebounced = debounce(async () => {
  const q = String(companyInput?.value || "").trim();
  if (q.length < 2) {
    liveCompanyNames = [];
    renderCompanyDropdown({ forceOpen: true });
    return;
  }
  try {
    const res = await fetch(`/api/company-suggest?query=${encodeURIComponent(q)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return;
    liveCompanyNames = uniqStrings(data.companies || []);
    renderCompanyDropdown({ forceOpen: true });
  } catch {
    // ignore
  }
}, 180);

companyInput?.addEventListener("focus", () => {
  renderCompanyDropdown({ forceOpen: true });
});

companyInput?.addEventListener("input", () => {
  renderCompanyDropdown({ forceOpen: true });
  fetchCompanySuggestDebounced();
});

companyInput?.addEventListener("keydown", (e) => {
  if (!companyDropdown || companyDropdown.classList.contains("hidden")) {
    if (e.key === "ArrowDown") {
      renderCompanyDropdown({ forceOpen: true });
      setActiveItem(0);
      e.preventDefault();
    }
    return;
  }

  const inner = ensureDropdownShell();
  const items = inner ? Array.from(inner.querySelectorAll(".typeaheadItem")) : [];
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    setActiveItem((taActiveIndex < 0 ? -1 : taActiveIndex) + 1);
    e.preventDefault();
  } else if (e.key === "ArrowUp") {
    setActiveItem((taActiveIndex < 0 ? items.length : taActiveIndex) - 1);
    e.preventDefault();
  } else if (e.key === "Enter") {
    if (taActiveIndex >= 0 && items[taActiveIndex]) {
      commitCompanyValue(items[taActiveIndex].getAttribute("data-value") || "");
      e.preventDefault();
    }
  } else if (e.key === "Escape") {
    closeCompanyDropdown();
    e.preventDefault();
  }
});

companyDropdown?.addEventListener("mousedown", (e) => {
  const btn = e.target?.closest?.(".typeaheadItem");
  if (!btn) return;
  e.preventDefault(); // prevent input blur before click
  commitCompanyValue(btn.getAttribute("data-value") || "");
});

document.addEventListener("mousedown", (e) => {
  const within =
    e.target?.closest?.("#companyTypeahead") || e.target?.closest?.("#companyDropdown") || null;
  if (!within) closeCompanyDropdown();
});

async function initProviderStatus() {
  try {
    const res = await fetch("/api/provider-status");
    const data = await res.json().catch(() => ({}));
    if (!providerSel) return;
    const apolloOpt = providerSel.querySelector('option[value="apollo"]');
    if (!apolloOpt) return;
    const apollo = data?.providers?.apollo || {};

    if (!apollo.configured) {
      apolloOpt.disabled = true;
      apolloOpt.textContent = "Apollo (set APOLLO_API_KEY)";
      return;
    }
    if (apollo.looksLikeGraphOS) {
      apolloOpt.disabled = true;
      apolloOpt.textContent = "Apollo (GraphOS key detected â€” needs Apollo.io key)";
      return;
    }
  } catch {
    // ignore
  }
}

function toast(type, title, msg, { timeoutMs = 3500 } = {}) {
  let wrap = document.querySelector(".toastWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toastWrap";
    document.body.appendChild(wrap);
  }

  const el = document.createElement("div");
  el.className = `toast ${type === "bad" ? "bad" : "good"}`;
  el.innerHTML = `<div class="toastTitle">${escapeHtml(title)}</div><div class="toastMsg">${escapeHtml(
    msg || "",
  )}</div>`;
  wrap.appendChild(el);

  const remove = () => {
    el.classList.add("toastOut");
    setTimeout(() => el.remove(), 170);
  };

  setTimeout(remove, timeoutMs);
  el.addEventListener("click", remove);
}

function setStatus(type, html) {
  statusEl.classList.remove("empty", "good", "bad");
  statusEl.classList.add(type);
  statusEl.innerHTML = html;
}

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  if (isLoading) spinner.classList.remove("hidden");
  else spinner.classList.add("hidden");
}

function setTab(which) {
  const isSend = which === "send";
  const isAts = which === "ats";
  const isHr = which === "hr";
  const isAuto = which === "auto";
  const isDefaults = which === "defaults";

  tabSend?.classList.toggle("active", isSend);
  tabAts?.classList.toggle("active", isAts);
  tabHr?.classList.toggle("active", isHr);
  tabAuto?.classList.toggle("active", isAuto);
  tabDefaults?.classList.toggle("active", isDefaults);

  panelSend?.classList.toggle("hidden", !isSend);
  panelAts?.classList.toggle("hidden", !isAts);
  panelHr?.classList.toggle("hidden", !isHr);
  panelAuto?.classList.toggle("hidden", !isAuto);
  panelDefaults?.classList.toggle("hidden", !isDefaults);

  // Keep the right-side status visible for send; hide for other tabs to give space.
  panelSide?.classList.toggle("hidden", !isSend);
}

tabSend?.addEventListener("click", () => setTab("send"));
tabAts?.addEventListener("click", () => setTab("ats"));
tabHr?.addEventListener("click", () => setTab("hr"));
tabAuto?.addEventListener("click", () => setTab("auto"));
tabDefaults?.addEventListener("click", () => setTab("defaults"));

initProviderStatus();
loadSavedCompanyNames();

// -------------------------
// Defaults tab (settings)
// -------------------------
const defSmtpHost = $("#defSmtpHost");
const defSmtpPort = $("#defSmtpPort");
const defSmtpSecure = $("#defSmtpSecure");
const defSmtpUser = $("#defSmtpUser");
const defSmtpPass = $("#defSmtpPass");
const defFromEmail = $("#defFromEmail");
const defFromName = $("#defFromName");
const defSubject = $("#defSubject");
const defBody = $("#defBody");
const defDob = $("#defDob");
const defExperience = $("#defExperience");
const defNoticePeriod = $("#defNoticePeriod");
const defExpectedCtc = $("#defExpectedCtc");
const defCurrentLocation = $("#defCurrentLocation");
const defPreferredLocation = $("#defPreferredLocation");
const defResume = $("#defResume");
const defUploadResumeBtn = $("#defUploadResumeBtn");
const defSaveBtn = $("#defSaveBtn");
const defStatus = $("#defStatus");

function setDefStatus(type, html) {
  if (!defStatus) return;
  defStatus.classList.remove("empty", "good", "bad");
  defStatus.classList.add(type);
  defStatus.innerHTML = html;
}

async function loadDefaultsIntoUI() {
  if (!defSmtpHost) return;
  try {
    const res = await fetch("/api/settings");
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (${res.status})`);
    const s = data.settings || {};
    defSmtpHost.value = s.smtpHost || "";
    defSmtpPort.value = s.smtpPort ? String(s.smtpPort) : "";
    defSmtpSecure.value = String(Boolean(s.smtpSecure));
    defSmtpUser.value = s.smtpUser || "";
    defFromEmail.value = s.fromEmail || "";
    defFromName.value = s.fromName || "";
    defSubject.value = s.subject || "";
    defBody.value = s.defaultBody || "";
    if (defDob) defDob.value = s.dateOfBirth || "";
    if (defExperience) defExperience.value = s.totalExperience || "";
    if (defNoticePeriod) defNoticePeriod.value = s.noticePeriod || "";
    if (defExpectedCtc) defExpectedCtc.value = s.expectedCtc || "";
    if (defCurrentLocation) defCurrentLocation.value = s.currentLocation || "";
    if (defPreferredLocation) defPreferredLocation.value = s.preferredLocation || "";
    defSmtpPass.value = "";

    // Also apply defaults into Send tab (only if user hasn't typed overrides).
    if (subjectInput && !String(subjectInput.value || "").trim() && s.subject) {
      subjectInput.value = String(s.subject || "");
    }
    if (bodyInput && !String(bodyInput.value || "").trim() && s.defaultBody) {
      bodyInput.value = String(s.defaultBody || "");
    }

    setDefStatus(
      "empty",
      `Loaded. Saved password: <strong>${s.smtpPassSet ? "yes" : "no"}</strong>. Resume uploaded: <strong>${s.resumeSet ? "yes" : "no"
      }</strong>.`,
    );
  } catch (e) {
    setDefStatus("bad", `<strong>Failed to load.</strong><br/>${escapeHtml(String(e?.message || e))}`);
  }
}

defSaveBtn?.addEventListener("click", async () => {
  try {
    setDefStatus("empty", "Savingâ€¦");
    const payload = {
      smtpHost: String(defSmtpHost?.value || "").trim(),
      smtpPort: Number(String(defSmtpPort?.value || "").trim() || 0) || null,
      smtpSecure: String(defSmtpSecure?.value || "false") === "true",
      smtpUser: String(defSmtpUser?.value || "").trim(),
      smtpPass: String(defSmtpPass?.value || ""),
      fromEmail: String(defFromEmail?.value || "").trim(),
      fromName: String(defFromName?.value || "").trim(),
      subject: String(defSubject?.value || "").trim(),
      defaultBody: String(defBody?.value || "").trim(),
      dateOfBirth: String(defDob?.value || "").trim(),
      totalExperience: String(defExperience?.value || "").trim(),
      noticePeriod: String(defNoticePeriod?.value || "").trim(),
      expectedCtc: String(defExpectedCtc?.value || "").trim(),
      currentLocation: String(defCurrentLocation?.value || "").trim(),
      preferredLocation: String(defPreferredLocation?.value || "").trim(),
    };
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = data.error || `Request failed (${res.status})`;
      setDefStatus("bad", `<strong>Save failed.</strong><br/>${escapeHtml(err)}`);
      toast("bad", "Save failed", err);
      return;
    }
    defSmtpPass.value = "";
    setDefStatus("good", "<strong>Saved.</strong> Defaults updated.");
    toast("good", "Saved", "Defaults updated");
  } catch (e) {
    const msg = String(e?.message || e);
    setDefStatus("bad", `<strong>Error.</strong><br/>${escapeHtml(msg)}`);
    toast("bad", "Error", msg);
  }
});

defUploadResumeBtn?.addEventListener("click", async () => {
  const f = defResume?.files?.[0];
  if (!f) {
    toast("bad", "Missing file", "Choose a PDF resume first.");
    return;
  }
  if (!String(f.name || "").toLowerCase().endsWith(".pdf")) {
    toast("bad", "Invalid file", "Resume must be a PDF.");
    return;
  }
  try {
    setDefStatus("empty", "Uploading resumeâ€¦");
    const fd = new FormData();
    fd.set("resume", f);
    const res = await fetch("/api/settings/resume", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = data.error || `Request failed (${res.status})`;
      setDefStatus("bad", `<strong>Upload failed.</strong><br/>${escapeHtml(err)}`);
      toast("bad", "Upload failed", err);
      return;
    }
    setDefStatus("good", "<strong>Uploaded.</strong> Default resume updated.");
    toast("good", "Uploaded", "Default resume updated");
    await loadDefaultsIntoUI();
  } catch (e) {
    const msg = String(e?.message || e);
    setDefStatus("bad", `<strong>Error.</strong><br/>${escapeHtml(msg)}`);
    toast("bad", "Error", msg);
  }
});

loadDefaultsIntoUI();

function updateFileUI() {
  const f = resumeInput.files && resumeInput.files[0];
  if (!f) {
    filePill.classList.add("hidden");
    fileName.textContent = "";
    return;
  }
  filePill.classList.remove("hidden");
  fileName.textContent = `${f.name} (${Math.round(f.size / 1024)} KB)`;
}

resumeInput.addEventListener("change", updateFileUI);
clearFile.addEventListener("click", () => {
  resumeInput.value = "";
  updateFileUI();
});

function prevent(e) {
  e.preventDefault();
  e.stopPropagation();
}

["dragenter", "dragover"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    prevent(e);
    dropzone.classList.add("drag");
  });
});

["dragleave", "drop"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    prevent(e);
    dropzone.classList.remove("drag");
  });
});

dropzone.addEventListener("drop", (e) => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!f) return;
  if (!f.name.toLowerCase().endsWith(".pdf")) {
    setStatus("bad", "<strong>Resume must be a PDF.</strong>");
    return;
  }
  const dt = new DataTransfer();
  dt.items.add(f);
  resumeInput.files = dt.files;
  updateFileUI();
});

resetBtn.addEventListener("click", () => {
  form.reset();
  resumeInput.value = "";
  updateFileUI();
  statusEl.className = "status empty";
  statusEl.textContent = "Fill the form and click Send Email.";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = $("#email").value.trim();
  if (!email) {
    setStatus("bad", "<strong>Email is required.</strong>");
    return;
  }

  setLoading(true);
  setStatus("empty", "Sendingâ€¦");

  const fd = new FormData();
  fd.set("email", email);
  fd.set("name", $("#name").value.trim());
  fd.set("subject", $("#subject").value.trim());
  fd.set("body", $("#body").value.trim());

  const f = resumeInput.files && resumeInput.files[0];
  if (f) fd.set("resume", f);

  try {
    const res = await fetch("/api/send", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = data.error || `Request failed (${res.status})`;
      setStatus("bad", `<strong>Failed.</strong><br/>${escapeHtml(err)}`);
      toast("bad", "Email failed", err);
      return;
    }

    const defaults = data.usedDefaults || {};
    setStatus(
      "good",
      `<strong>Sent!</strong><br/>
      To: <code>${escapeHtml(data.toEmail)}</code><br/>
      Subject: <code>${escapeHtml(data.subject || "")}</code><br/>
      <div style="margin-top:10px;color:rgba(255,255,255,.75)">
        Used defaults: subject=${defaults.subject ? "yes" : "no"}, body=${defaults.body ? "yes" : "no"
      }, resume=${defaults.resume ? "yes" : "no"}
      </div>`,
    );
    toast("good", "Email sent", data.toEmail);
  } catch (err) {
    const msg = String(err?.message || err);
    setStatus("bad", `<strong>Error.</strong><br/>${escapeHtml(msg)}`);
    toast("bad", "Error", msg);
  } finally {
    setLoading(false);
  }
});

logoutBtn?.addEventListener("click", async () => {
  try {
    await fetch("/api/logout", { method: "POST" });
  } catch { }
  window.location.href = "/login";
});

function renderHrResults(contacts, meta = {}) {
  lastHrContacts = Array.isArray(contacts) ? contacts : [];
  const phones = (lastHrContacts || [])
    .map((c) => String(c?.phone || "").trim())
    .filter(Boolean);
  const uniqPhones = Array.from(new Set(phones));
  lastHrPhone = meta.phone || uniqPhones.join("\n") || "";
  if (!lastHrContacts.length) {
    hrResults.className = "status empty";
    hrResults.innerHTML = "No HR / Talent contacts found.";
    return;
  }

  const cards = lastHrContacts
    .map((c) => {
      const name = c.name ? escapeHtml(c.name) : "Hiring Team";
      const pos = c.position ? escapeHtml(c.position) : "HR / Talent";
      const email = c.email ? escapeHtml(c.email) : "â€”";
      const phone = c.phone ? escapeHtml(c.phone) : "";
      const sendName = escapeHtml(String(c.name || "Hiring Team"));
      const conf =
        c.confidence === null || c.confidence === undefined ? "â€”" : escapeHtml(String(c.confidence));
      return `
        <div class="hrCard">
          <div class="hrName">${name}</div>
          <div class="hrRole">${pos}</div>
          <div class="hrEmailRow">
            <code class="hrEmail" title="${email}">${email}</code>
            <button class="iconBtn js-copy-email" type="button" data-email="${email}" title="Copy email">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 9h10v10H9V9Z" stroke="currentColor" stroke-width="2" />
                <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="2" />
              </svg>
            </button>
            <button class="iconBtn js-send-hr-email" type="button" data-email="${email}" data-name="${sendName}" title="Send email">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          ${phone
          ? `<div class="hrEmailRow" style="margin-top:8px">
                  <code class="hrEmail" title="${phone}">${phone}</code>
                  <button class="iconBtn js-copy-phone" type="button" data-phone="${phone}" title="Copy phone">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9 9h10v10H9V9Z" stroke="currentColor" stroke-width="2" />
                      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="2" />
                    </svg>
                  </button>
                </div>`
          : ""
        }
          <div class="hrBottomRow">
            <span class="hrBadge">Confidence</span>
            <span class="hrBadge">${conf}</span>
          </div>
        </div>
      `;
    })
    .join("");

  hrResults.className = "status";
  hrResults.innerHTML = `
    <div style="margin-bottom:10px;color:rgba(255,255,255,.75)">
      <div class="hrMetaRow">
        <div>
          Found <strong>${lastHrContacts.length}</strong> contacts for
          <code>${escapeHtml(meta.domain || meta.company || "â€”")}</code>
        </div>
        ${meta.phone
      ? `<div style="color:rgba(255,255,255,.78)">Company phone: <code>${escapeHtml(
        meta.phone,
      )}</code></div>`
      : ""
    }
      </div>
      ${meta.mode === "all_emails_fallback"
      ? `<div style="margin-top:6px;color:rgba(255,211,109,.9)"><strong>Note:</strong> HR/TA roles not available for this domain; showing all discovered emails.</div>`
      : ""
    }
    </div>
    <div class="hrCards">${cards}</div>
  `;
}

hrResults?.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.(".js-copy-email");
  const phoneBtn = e.target?.closest?.(".js-copy-phone");
  const sendBtn = e.target?.closest?.(".js-send-hr-email");
  if (!btn && !phoneBtn && !sendBtn) return;

  if (sendBtn) {
    const email = String(sendBtn.getAttribute("data-email") || "").trim();
    const name = String(sendBtn.getAttribute("data-name") || "").trim();
    if (!email || email === "â€”") {
      toast("bad", "Send failed", "No email found");
      return;
    }

    const oldText = sendBtn.getAttribute("data-old-text") || "";
    if (!oldText) sendBtn.setAttribute("data-old-text", sendBtn.innerHTML);
    sendBtn.disabled = true;
    sendBtn.style.opacity = "0.7";
    sendBtn.innerHTML = `<span style="font-size:12px;font-weight:800">â€¦</span>`;

    try {
      const fd = new FormData();
      fd.set("email", email);
      fd.set("name", name);
      // subject/body empty => defaults
      fd.set("subject", "");
      fd.set("body", "");

      const res = await fetch("/api/send", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const err = data.error || `Request failed (${res.status})`;
        toast("bad", "Send failed", err);
        return;
      }
      toast("good", "Email sent", email);
    } catch (err) {
      const msg = String(err?.message || err);
      toast("bad", "Send failed", msg);
    } finally {
      const html = sendBtn.getAttribute("data-old-text");
      if (html) sendBtn.innerHTML = html;
      sendBtn.disabled = false;
      sendBtn.style.opacity = "";
    }
    return;
  }

  const val = btn
    ? btn.getAttribute("data-email") || ""
    : phoneBtn
      ? phoneBtn.getAttribute("data-phone") || ""
      : "";
  const label = btn ? "email" : "phone";

  if (!val || val === "â€”") {
    toast("bad", "Copy failed", `No ${label} to copy`);
    return;
  }
  try {
    await navigator.clipboard.writeText(val);
    toast("good", "Copied", val);
  } catch {
    toast("bad", "Copy failed", "Browser blocked clipboard. Copy manually.");
  }
});

hrSearchBtn?.addEventListener("click", async () => {
  const company = ($("#company")?.value || "").trim();
  const domain = ($("#domain")?.value || "").trim();
  const provider = (providerSel?.value || "hunter").trim();

  if (!company && !domain) {
    toast("bad", "Missing input", "Enter company name or domain.");
    return;
  }

  hrResults.className = "status empty";
  hrResults.innerHTML = "Searchingâ€¦";

  try {
    const qs = new URLSearchParams();
    if (company) qs.set("company", company);
    if (domain) qs.set("domain", domain);
    if (provider) qs.set("provider", provider);
    const res = await fetch(`/api/hr-lookup?${qs.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = data.error || `Request failed (${res.status})`;
      hrResults.className = "status bad";
      hrResults.innerHTML = `<strong>Failed.</strong><br/>${escapeHtml(err)}`;
      toast("bad", "HR lookup failed", err);
      return;
    }
    renderHrResults(data.contacts || [], {
      domain: data.domain,
      company: data.company,
      mode: data.mode,
      phone: data.phone,
    });
    toast("good", "HR lookup complete", `${(data.contacts || []).length} contacts found`);
  } catch (e) {
    const msg = String(e?.message || e);
    hrResults.className = "status bad";
    hrResults.innerHTML = `<strong>Error.</strong><br/>${escapeHtml(msg)}`;
    toast("bad", "Error", msg);
  }
});

bulkSendBtn?.addEventListener("click", async () => {
  const mode = String(bulkModeSel?.value || "excel");

  setLoading(true);
  setStatus("empty", "Sending bulk emailsâ€¦ (this may take a bit)");

  const fd = new FormData();
  if (mode === "excel") {
    const excel = excelInput?.files?.[0];
    if (!excel) {
      setLoading(false);
      setStatus("bad", "<strong>Excel (.xlsx) is required for bulk send.</strong>");
      return;
    }
    if (!excel.name.toLowerCase().endsWith(".xlsx")) {
      setLoading(false);
      setStatus("bad", "<strong>Please upload a valid .xlsx file.</strong>");
      return;
    }
    fd.set("excel", excel);
  } else {
    const raw = String(bulkEmailsTa?.value || "").trim();
    if (!raw) {
      setLoading(false);
      setStatus("bad", "<strong>Please paste at least one email.</strong>");
      return;
    }
    fd.set("emails", raw);
  }

  const bulkResume = bulkResumeInput?.files?.[0];
  if (bulkResume) fd.set("resume", bulkResume);

  try {
    const res = await fetch(mode === "excel" ? "/api/send-bulk" : "/api/send-list", {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = data.error || `Request failed (${res.status})`;
      setStatus("bad", `<strong>Bulk send failed.</strong><br/>${escapeHtml(err)}`);
      toast("bad", "Bulk failed", err);
      return;
    }

    const failedLines =
      (data.results || [])
        .filter((r) => !r.ok)
        .slice(0, 8)
        .map((r) => `<li><code>${escapeHtml(r.email)}</code> â€” ${escapeHtml(r.error || "failed")}</li>`)
        .join("") || "";

    const sentLines =
      (data.results || [])
        .filter((r) => r.ok)
        .slice(0, 8)
        .map(
          (r) =>
            `<li><code>${escapeHtml(r.email)}</code> â€” <span style="color:rgba(109,255,181,.9)">sent</span></li>`,
        )
        .join("") || "";

    setStatus(
      data.failed ? "bad" : "good",
      `<strong>Bulk done.</strong><br/>
      Total: <code>${data.total}</code> | Sent: <code>${data.sent}</code> | Failed: <code>${data.failed}</code>
      ${sentLines
        ? `<div style="margin-top:10px;color:rgba(255,255,255,.75)"><strong>Sent (sample):</strong><ul style="margin:6px 0 0 18px">${sentLines}</ul></div>`
        : ""
      }
      ${failedLines
        ? `<div style="margin-top:10px;color:rgba(255,255,255,.75)"><strong>Some failures:</strong><ul style="margin:6px 0 0 18px">${failedLines}</ul></div>`
        : ""
      }`,
    );
    toast(
      data.failed ? "bad" : "good",
      "Bulk complete",
      `Sent ${data.sent}/${data.total} (${data.failed} failed)`,
      { timeoutMs: 4500 },
    );
  } catch (err) {
    const msg = String(err?.message || err);
    setStatus("bad", `<strong>Error.</strong><br/>${escapeHtml(msg)}`);
    toast("bad", "Error", msg);
  } finally {
    setLoading(false);
  }
});

function setBulkMode(mode) {
  const m = String(mode || "excel");
  bulkExcelWrap?.classList.toggle("hidden", m !== "excel");
  bulkPasteWrap?.classList.toggle("hidden", m !== "paste");
}

setBulkMode(bulkModeSel?.value || "excel");
bulkModeSel?.addEventListener("change", () => setBulkMode(bulkModeSel?.value || "excel"));

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// -------------------------
// AI Tailor
// -------------------------
const aiTailorBtn = $("#aiTailorBtn");
aiTailorBtn?.addEventListener("click", async () => {
  const jd = String(bodyInput?.value || "").trim();
  const name = String($("#name")?.value || "").trim();
  const resume = resumeInput?.files?.[0];

  if (!jd) {
    toast("bad", "Missing JD", "Paste the job description into the Body field first.");
    return;
  }

  aiTailorBtn.disabled = true;
  aiTailorBtn.textContent = "âœ¨ Tailoring...";
  setStatus("empty", "AI is tailoring your email body based on the JD...");

  try {
    const fd = new FormData();
    fd.set("jd", jd);
    fd.set("name", name);
    if (resume) fd.set("resume", resume);

    const res = await fetch("/api/generate-email", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      const err = data.error || `Request failed (${res.status})`;
      toast("bad", "AI Tailor failed", err);
      setStatus("bad", `<strong>AI Tailor failed.</strong><br/>${escapeHtml(err)}`);
      return;
    }

    bodyInput.value = data.body;
    toast("good", "AI Tailor complete", "Email body updated.");
    setStatus("good", "<strong>AI Tailor complete!</strong> Email body has been updated based on the JD.");
  } catch (e) {
    const msg = String(e?.message || e);
    toast("bad", "Error", msg);
    setStatus("bad", `<strong>Error.</strong><br/>${escapeHtml(msg)}`);
  } finally {
    aiTailorBtn.disabled = false;
    aiTailorBtn.textContent = "âœ¨ AI Tailor";
  }
});

// -------------------------
// ATS Optimizer
// -------------------------
const atsJd = $("#atsJd");
const atsResume = $("#atsResume");
const atsScoreBtn = $("#atsScoreBtn");
const atsOptimizeBtn = $("#atsOptimizeBtn");
const atsResults = $("#atsResults");
const atsDownloadWrap = $("#atsDownloadWrap");
const atsDownloadBtn = $("#atsDownloadBtn");

async function handleAts(mode) {
  const jd = String(atsJd?.value || "").trim();
  const resume = atsResume?.files?.[0];

  if (!jd || !resume) {
    toast("bad", "Missing input", "Paste JD and upload resume first.");
    return;
  }

  const btn = mode === "score" ? atsScoreBtn : atsOptimizeBtn;
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "...";
  atsResults.innerHTML = "Processing...";
  atsDownloadWrap.classList.add("hidden");

  try {
    const fd = new FormData();
    fd.set("jd", jd);
    fd.set("resume", resume);

    const endpoint = mode === "score" ? "/api/ats-score" : "/api/ats-optimize";
    const res = await fetch(endpoint, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      const err = data.error || `Request failed (${res.status})`;
      atsResults.innerHTML = `<strong class="bad">Failed:</strong> ${escapeHtml(err)}`;
      return;
    }

    const r = data.result;
    let html = `
      <div style="font-size:24px;font-weight:800;margin-bottom:10px;color:var(--accent2)">Score: ${r.score}/100</div>
      <div style="margin-bottom:10px">${escapeHtml(r.meta?.note || "")}</div>
      <div style="margin-bottom:10px">
        <strong>Matched Keywords:</strong><br/>
        <span style="color:var(--good)">${r.matchedKeywords.slice(0, 15).join(", ")}${r.matchedKeywords.length > 15 ? "..." : ""}</span>
      </div>
      <div style="margin-bottom:10px">
        <strong>Missing Keywords:</strong><br/>
        <span style="color:var(--bad)">${r.missingKeywords.slice(0, 15).join(", ")}${r.missingKeywords.length > 15 ? "..." : ""}</span>
      </div>
      <div>
        <strong>Suggestions:</strong>
        <ul style="margin:5px 0 0 18px;padding:0">
          ${r.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
      </div>
    `;

    atsResults.innerHTML = html;

    if (mode === "optimize" && data.optimized?.downloadUrl) {
      atsDownloadBtn.href = data.optimized.downloadUrl;
      atsDownloadWrap.classList.remove("hidden");
      toast("good", "Optimization complete", "You can now download the optimized resume.");
    } else {
      toast("good", "Analysis complete", `Score: ${r.score}/100`);
    }
  } catch (e) {
    atsResults.innerHTML = `<strong class="bad">Error:</strong> ${escapeHtml(String(e?.message || e))}`;
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

atsScoreBtn?.addEventListener("click", () => handleAts("score"));
atsOptimizeBtn?.addEventListener("click", () => handleAts("optimize"));

// -------------------------
// Auto-Apply Campaign
// -------------------------
const autoDomains = $("#autoDomains");
const autoStartBtn = $("#autoStartBtn");
const autoProgress = $("#autoProgress");

autoStartBtn?.addEventListener("click", async () => {
  const domainsRaw = String(autoDomains?.value || "").trim();
  if (!domainsRaw) {
    toast("bad", "Missing input", "Enter at least one domain.");
    return;
  }

  autoStartBtn.disabled = true;
  const oldText = autoStartBtn.textContent;
  autoStartBtn.textContent = "Running...";
  autoProgress.innerHTML = "Campaign started. Finding contacts and sending emails...";
  autoProgress.className = "status";

  try {
    const res = await fetch("/api/auto-apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domains: domainsRaw,
        provider: providerSel?.value || "hunter"
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = data.error || `Request failed (${res.status})`;
      autoProgress.innerHTML = `<strong class="bad">Campaign failed:</strong> ${escapeHtml(err)}`;
      toast("bad", "Campaign failed", err);
      return;
    }

    const results = data.results || [];
    let html = `<div style="margin-bottom:15px"><strong>Campaign Results:</strong></div>`;

    for (const r of results) {
      const domainEsc = escapeHtml(r.domain);
      html += `<div style="margin-bottom:10px; padding:10px; background:rgba(255,255,255,0.05); border-radius:6px">`;
      html += `<div style="font-weight:bold; color:var(--accent2)">${domainEsc}</div>`;

      if (r.errors && r.errors.length) {
        html += `<div style="color:var(--bad); font-size:12px">${r.errors.map(e => escapeHtml(e)).join("<br/>")}</div>`;
      }

      if (r.contacts && r.contacts.length) {
        html += `<ul style="margin:5px 0 0 18px; padding:0; font-size:13px">`;
        for (const c of r.contacts) {
          const status = c.ok ? `<span style="color:var(--good)">Sent</span>` : `<span style="color:var(--bad)">Failed: ${escapeHtml(c.error || "unknown")}</span>`;
          html += `<li>${escapeHtml(c.name || "Hiring Team")} (<code>${escapeHtml(c.email)}</code>) â€” ${status}</li>`;
        }
        html += `</ul>`;
      } else if (!r.errors || !r.errors.length) {
        html += `<div style="color:rgba(255,255,255,0.5); font-size:12px">No HR contacts found.</div>`;
      }
      html += `</div>`;
    }

    autoProgress.innerHTML = html;
    toast("good", "Campaign complete", `Processed ${results.length} domains.`);
  } catch (e) {
    const msg = String(e?.message || e);
    autoProgress.innerHTML = `<strong class="bad">Error:</strong> ${escapeHtml(msg)}`;
    toast("bad", "Error", msg);
  } finally {
    autoStartBtn.disabled = false;
    autoStartBtn.textContent = oldText;
  }
});

// -------------------------
// Job Automation
// -------------------------
const jobKeywords = $("#jobKeywords");
const jobLocation = $("#jobLocation");
const jobExperience = $("#jobExperience");
const jobPostedWithin = $("#jobPostedWithin");
const jobRemoteOnly = $("#jobRemoteOnly");
const jobPlatform = $("#jobPlatform");
const platformEmail = $("#platformEmail");
const platformPassword = $("#platformPassword");
const maxApplies = $("#maxApplies");
const headlessMode = $("#headlessMode");
const saveJobConfig = $("#saveJobConfig");
const loadJobConfig = $("#loadJobConfig");
const jobConfigStatus = $("#jobConfigStatus");
const scrapeJobsBtn = $("#scrapeJobsBtn");
const autoApplyBtn = $("#autoApplyBtn");
const refreshStatsBtn = $("#refreshStatsBtn");
const jobActionStatus = $("#jobActionStatus");
const testCredentials = $("#testCredentials");
const credentialTestStatus = $("#credentialTestStatus");
const refreshJobsBtn = $("#refreshJobsBtn");
const filterStatus = $("#filterStatus");
const filterPlatform = $("#filterPlatform");
const filterApplyType = $("#filterApplyType");
const jobsTable = $("#jobsTable");
const jobsTableBody = $("#jobsTableBody");
const jobsEmptyState = $("#jobsEmptyState");
const clearJobsBtn = $("#clearJobsBtn");

// -------------------------
// Job Automation Logic
// -------------------------

clearJobsBtn?.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to delete ALL jobs from the database? This cannot be undone.")) return;

  try {
    const res = await fetch("/api/jobs/clear", { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) throw new Error(data.error || "Clear failed");

    toast("good", "Database Cleared", "All jobs have been removed.");
    await refreshJobStats();
    await refreshJobsList();
  } catch (e) {
    toast("bad", "Clear Failed", String(e?.message || e));
  }
});

// Statistics elements
const statTotal = $("#statTotal");
const statPending = $("#statPending");
const statApplied = $("#statApplied");
const statToday = $("#statToday");

function setJobConfigStatus(type, html) {
  if (!jobConfigStatus) return;
  jobConfigStatus.classList.remove("empty", "good", "bad");
  jobConfigStatus.classList.add(type);
  jobConfigStatus.innerHTML = html;
}

function setJobActionStatus(type, html) {
  if (!jobActionStatus) return;
  jobActionStatus.classList.remove("empty", "good", "bad");
  jobActionStatus.classList.add(type);
  jobActionStatus.innerHTML = html;
}

// Load job configuration
async function loadJobConfiguration() {
  try {
    const res = await fetch("/api/jobs/config");
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (${res.status})`);

    const config = data.config || {};
    const criteria = config.searchCriteria || {};
    const platform = jobPlatform?.value || "naukri";
    const platformCfg = config.platforms?.[platform] || {};

    // Load search criteria
    if (jobKeywords) jobKeywords.value = criteria.keywords || "";
    if (jobLocation) jobLocation.value = criteria.location || "";
    if (jobExperience) jobExperience.value = criteria.experience || "";
    if (jobPostedWithin) jobPostedWithin.value = String(criteria.postedWithin || 1);
    if (jobRemoteOnly) jobRemoteOnly.value = String(criteria.remote !== false);

    // Load platform credentials
    if (platformEmail) platformEmail.value = platformCfg.credentials?.email || "";
    if (maxApplies) maxApplies.value = String(platformCfg.maxAppliesPerDay || 30);

    // Load automation settings
    if (headlessMode) headlessMode.value = String(config.automation?.headless || false);

    setJobConfigStatus("good", "Configuration loaded");
    return config;
  } catch (e) {
    setJobConfigStatus("bad", `Failed to load: ${escapeHtml(String(e?.message || e))}`);
    return null;
  }
}

// Save job configuration
saveJobConfig?.addEventListener("click", async () => {
  try {
    setJobConfigStatus("empty", "Saving...");

    const platform = jobPlatform?.value || "naukri";
    const config = {
      searchCriteria: {
        keywords: jobKeywords?.value?.trim() || "",
        location: jobLocation?.value?.trim() || "",
        experience: jobExperience?.value?.trim() || "",
        postedWithin: parseInt(jobPostedWithin?.value || "1"),
        remote: jobRemoteOnly?.value === "true",
      },
      platforms: {
        [platform]: {
          enabled: true,
          credentials: {
            email: platformEmail?.value?.trim() || "",
            password: platformPassword?.value || "",
          },
          maxAppliesPerDay: parseInt(maxApplies?.value || "30"),
        },
      },
      automation: {
        headless: headlessMode?.value === "true",
        autoApplyEnabled: true,
        delayBetweenApplications: 5000,
      },
    };

    const res = await fetch("/api/jobs/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (${res.status})`);

    setJobConfigStatus("good", "<strong>Saved!</strong> Configuration updated.");
    toast("good", "Configuration saved", "Job automation settings updated");

    // Clear password field
    if (platformPassword) platformPassword.value = "";
  } catch (e) {
    const msg = String(e?.message || e);
    setJobConfigStatus("bad", `<strong>Save failed:</strong> ${escapeHtml(msg)}`);
    toast("bad", "Save failed", msg);
  }
});

// Load configuration button
loadJobConfig?.addEventListener("click", async () => {
  await loadJobConfiguration();
  toast("good", "Configuration loaded", "Settings refreshed from server");
});

// Refresh statistics
async function refreshJobStats() {
  try {
    const res = await fetch("/api/jobs/stats");
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (${res.status})`);

    const stats = data.stats || {};
    if (statTotal) statTotal.textContent = stats.total || 0;
    if (statPending) statPending.textContent = stats.pending || 0;
    if (statApplied) statApplied.textContent = stats.applied || 0;
    if (statToday) statToday.textContent = stats.appliedToday || 0;

    return stats;
  } catch (e) {
    console.error("Failed to refresh stats:", e);
    return null;
  }
}

refreshStatsBtn?.addEventListener("click", async () => {
  await refreshJobStats();
  toast("good", "Statistics refreshed", "Job stats updated");
});

//Scrape jobs
scrapeJobsBtn?.addEventListener("click", async () => {
  try {
    const keywords = jobKeywords?.value?.trim();
    if (!keywords) {
      toast("bad", "Missing keywords", "Please enter job keywords to search for");
      return;
    }

    const platform = jobPlatform?.value || "naukri";
    scrapeJobsBtn.disabled = true;
    const oldText = scrapeJobsBtn.textContent;
    scrapeJobsBtn.textContent = "Scraping... (this may take a minute)";
    setJobActionStatus("empty", "Scraping jobs from " + platform + "...");

    const criteria = {
      keywords: keywords,
      location: jobLocation?.value?.trim() || "",
      experience: jobExperience?.value?.trim() || "",
      postedWithin: parseInt(jobPostedWithin?.value || "1"),
      remote: jobRemoteOnly?.value === "true",
    };

    const res = await fetch("/api/jobs/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, criteria }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (${res.status})`);

    setJobActionStatus(
      "good",
      `<strong>Scraping complete!</strong><br/>Found ${data.scraped} jobs, added ${data.added} new jobs to database.`
    );

    toast("good", "Scraping complete", `${data.added} new jobs added`);

    // Refresh stats and job list
    await refreshJobStats();
    await refreshJobsList();
  } catch (e) {
    const msg = String(e?.message || e);
    setJobActionStatus("bad", `<strong>Scraping failed:</strong> ${escapeHtml(msg)}`);
    toast("bad", "Scraping failed", msg);
  } finally {
    scrapeJobsBtn.disabled = false;
    scrapeJobsBtn.textContent = "ðŸ” Scrape Jobs Now";
  }
});

// Auto-apply to pending jobs
autoApplyBtn?.addEventListener("click", async () => {
  try {
    const platform = jobPlatform?.value || "naukri";

    autoApplyBtn.disabled = true;
    const oldText = autoApplyBtn.textContent;
    autoApplyBtn.textContent = "Applying... (this may take several minutes)";
    setJobActionStatus("empty", "Auto-applying to pending jobs...");

    const res = await fetch("/api/jobs/auto-apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (${res.status})`);

    setJobActionStatus(
      "good",
      `<strong>Auto-apply complete!</strong><br/>Applied: ${data.successful}/${data.total} jobs`
    );

    toast("good", "Auto-apply complete", `${data.successful} successful applications`);

    // Refresh stats and job list
    await refreshJobStats();
    await refreshJobsList();
  } catch (e) {
    const msg = String(e?.message || e);
    setJobActionStatus("bad", `<strong>Auto-apply failed:</strong> ${escapeHtml(msg)}`);
    toast("bad", "Auto-apply failed", msg);
  } finally {
    autoApplyBtn.disabled = false;
    autoApplyBtn.textContent = "âš¡ Auto-Apply to Pending Jobs";
  }
});

// Refresh jobs list
async function refreshJobsList() {
  try {
    const status = filterStatus?.value || "";
    const platform = filterPlatform?.value || "";
    const applyType = filterApplyType?.value || "";

    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (platform) params.append("platform", platform);

    const res = await fetch(`/api/jobs?${params.toString()}`);
    const data = await res.json().catch(() => ({}));

    // If API fails, show empty state
    if (!res.ok || !data.ok) {
      if (jobsTable) jobsTable.style.display = "none";
      if (jobsEmptyState) {
        jobsEmptyState.style.display = "block";
        jobsEmptyState.classList.remove("hidden");
        jobsEmptyState.innerHTML = `No jobs found. Click "Scrape Jobs Now" to fetch jobs.`;
      }
      return;
    }

    let jobs = data.jobs || [];

    // Client-side filter by application type
    if (applyType) {
      jobs = jobs.filter(job => {
        const isManualApply = job.isExternalApply === true ||
          (job.applicationStatus === "skipped" && job.failureReason === "Manual Apply (Company Site)");

        if (applyType === "manual") {
          return isManualApply;
        } else if (applyType === "auto") {
          return !isManualApply;
        }
        return true;
      });
    }

    if (jobs.length === 0) {
      if (jobsTable) jobsTable.style.display = "none";
      if (jobsEmptyState) {
        jobsEmptyState.style.display = "block";
        jobsEmptyState.classList.remove("hidden");
        jobsEmptyState.innerHTML = `No jobs found. Click "Scrape Jobs Now" to fetch jobs.`;
      }
    } else {
      if (jobsTable) jobsTable.style.display = "table";
      if (jobsEmptyState) {
        jobsEmptyState.style.display = "none";
        jobsEmptyState.classList.add("hidden");
      }

      const rows = jobs.map(job => {
        // Check if this is a manual apply job (external application required)
        const isManualApply = job.isExternalApply === true ||
          (job.applicationStatus === "skipped" && job.failureReason === "Manual Apply (Company Site)");

        const statusBadge = job.applicationStatus === "applied"
          ? `<span style="display:inline-block;padding:4px 8px;background:#059669;color:white;border-radius:4px;font-size:11px;font-weight:600">Applied</span>`
          : job.applicationStatus === "failed"
            ? `<span style="display:inline-block;padding:4px 8px;background:#dc2626;color:white;border-radius:4px;font-size:11px;font-weight:600">Failed</span>`
            : job.applicationStatus === "skipped"
              ? (job.failureReason === "Manual Apply (Company Site)"
                ? `<span style="display:inline-block;padding:4px 8px;background:#f59e0b;color:white;border-radius:4px;font-size:11px;font-weight:600" title="Please apply on company site manually">Manual Apply</span>`
                : `<span style="display:inline-block;padding:4px 8px;background:#6b7280;color:white;border-radius:4px;font-size:11px;font-weight:600">Skipped</span>`)
              : isManualApply
                ? `<span style="display:inline-block;padding:4px 8px;background:#f59e0b;color:white;border-radius:4px;font-size:11px;font-weight:600" title="Requires manual application on company site">Manual Apply</span>`
                : `<span style="display:inline-block;padding:4px 8px;background:#ea580c;color:white;border-radius:4px;font-size:11px;font-weight:600">Pending</span>`;

        let actionHtml = "â€”";

        // For manual apply jobs, show "Apply on Site" button from the start
        if (isManualApply && (job.externalUrl || job.url)) {
          const applyUrl = job.externalUrl || job.url;
          actionHtml = `<a href="${escapeHtml(applyUrl)}" target="_blank" class="btn secondary" style="display:inline-block;min-width:auto;padding:6px 12px;font-size:11px;text-decoration:none;background:#f59e0b;color:white;border:none">Apply on Site</a>`;
        } else if (job.applicationStatus === "pending") {
          actionHtml = `
            <button class="btn secondary js-apply-job" data-job-id="${job.jobId}" data-platform="${job.platform}" style="min-width:auto;padding:6px 12px;font-size:11px">Auto Apply</button>
            <button class="btn secondary js-skip-job" data-job-id="${job.jobId}" data-platform="${job.platform}" style="min-width:auto;padding:6px 12px;font-size:11px;margin-left:5px">Skip</button>
          `;
        }

        return `
          <tr style="border-bottom:1px solid #eee">
            <td style="padding:10px;font-size:12px">${escapeHtml(job.platform)}</td>
            <td style="padding:10px;font-size:12px">
              <a href="${escapeHtml(job.url)}" target="_blank" style="color:#0066cc;text-decoration:none">${escapeHtml(job.title)}</a>
            </td>
            <td style="padding:10px;font-size:12px">${escapeHtml(job.company || "â€”")}</td>
            <td style="padding:10px;font-size:12px">${escapeHtml(job.location || "â€”")}</td>
            <td style="padding:10px;font-size:12px">${statusBadge}</td>
            <td style="padding:10px;font-size:12px">${escapeHtml(job.postedDate || "â€”")}</td>
            <td style="padding:10px;font-size:12px">${actionHtml}</td>
          </tr>
        `;
      }).join("");

      if (jobsTableBody) jobsTableBody.innerHTML = rows;
    }
  } catch (e) {
    console.error("Failed to refresh jobs list:", e);
    // Show empty state on error
    if (jobsTable) jobsTable.style.display = "none";
    if (jobsEmptyState) {
      jobsEmptyState.style.display = "block";
      jobsEmptyState.classList.remove("hidden");
      jobsEmptyState.innerHTML = `No jobs found.Click "Scrape Jobs Now" to fetch jobs.`;
    }
  }
}

refreshJobsBtn?.addEventListener("click", refreshJobsList);
filterStatus?.addEventListener("change", refreshJobsList);
filterPlatform?.addEventListener("change", refreshJobsList);
filterApplyType?.addEventListener("change", refreshJobsList);

// Job actions (Apply, Skip)
jobsTableBody?.addEventListener("click", async (e) => {
  const applyBtn = e.target?.closest?.(".js-apply-job");
  const skipBtn = e.target?.closest?.(".js-skip-job");

  if (applyBtn) {
    const jobId = applyBtn.getAttribute("data-job-id");
    const platform = applyBtn.getAttribute("data-platform");

    applyBtn.disabled = true;
    applyBtn.textContent = "Applying...";

    try {
      const res = await fetch(`/ api / jobs / apply / ${jobId} `, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `Request failed(${res.status})`);

      toast("good", "Application submitted", "Job application sent successfully");
      await refreshJobStats();
      await refreshJobsList();
    } catch (e) {
      const msg = String(e?.message || e);
      toast("bad", "Application failed", msg);
      applyBtn.disabled = false;
      applyBtn.textContent = "Apply";
    }
  }

  if (skipBtn) {
    const jobId = skipBtn.getAttribute("data-job-id");
    const platform = skipBtn.getAttribute("data-platform");

    try {
      const res = await fetch(`/ api / jobs / ${platform}/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "skipped" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (${res.status})`);

      toast("good", "Job skipped", "Marked as skipped");
      await refreshJobStats();
      await refreshJobsList();
    } catch (e) {
      const msg = String(e?.message || e);
      toast("bad", "Skip failed", msg);
    }
  }
});

function setCredentialTestStatus(type, html) {
  if (!credentialTestStatus) return;
  credentialTestStatus.style.display = "block";
  credentialTestStatus.classList.remove("empty", "good", "bad");
  credentialTestStatus.classList.add(type);
  credentialTestStatus.innerHTML = html;
}

// Test credentials
testCredentials?.addEventListener("click", async () => {
  try {
    const platform = jobPlatform?.value || "naukri";
    const email = platformEmail?.value?.trim();
    const password = platformPassword?.value;

    if (!email || !password) {
      // Check if we can use saved credentials
      const resConfig = await fetch("/api/jobs/config");
      const configData = await resConfig.json().catch(() => ({}));
      const currentConfig = configData.config || {};
      const platformCfg = currentConfig.platforms?.[platform] || {};

      if (!email && !platformCfg.credentials?.email) {
        toast("bad", "Missing Email", "Please enter your email address");
        return;
      }

      // If password is empty, the server will try to use the saved one
    }

    testCredentials.disabled = true;
    const oldText = testCredentials.textContent;
    testCredentials.textContent = "Testing...";
    setCredentialTestStatus("empty", "Verifying credentials... login attempt in progress.");

    const res = await fetch("/api/jobs/test-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        credentials: {
          email: email || undefined,
          password: password || undefined
        }
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Login failed (${res.status})`);
    }

    setCredentialTestStatus("good", `<strong>Success!</strong> ${data.message}`);
    toast("good", "Login Verified", "Your credentials are correct!");

  } catch (e) {
    const msg = String(e?.message || e);
    setCredentialTestStatus("bad", `<strong>Verification failed:</strong> ${escapeHtml(msg)}`);
    toast("bad", "Login Failed", msg);
  } finally {
    testCredentials.disabled = false;
    testCredentials.textContent = "ðŸ” Test Credentials";
  }
});

// Load job config and stats on tab switch
tabAuto?.addEventListener("click", async () => {
  try {
    await loadJobConfiguration();
    await refreshJobStats();
    await refreshJobsList();
  } catch (e) {
    console.error("Error loading auto apply tab:", e);
  }
});

// Initialize empty state on first load
if (jobsEmptyState) {
  jobsEmptyState.style.display = "block";
  jobsEmptyState.classList.remove("hidden");
}
if (jobsTable) {
  jobsTable.style.display = "none";
}


// AI Tailor Feature (Added by Bot)

// AI Tailor Feature (Robust Version)
const btnAiTailor = $("#aiTailorBtn");
if (btnAiTailor) {
  btnAiTailor.addEventListener("click", async () => {
    try {
      const atsJdVal = $("#atsJd")?.value?.trim();
      let finalJd = atsJdVal;
      
      if (!finalJd) {
        const pasted = prompt("Please paste the Job Description here to tailor your email:");
        if (!pasted) return;
        finalJd = pasted.trim();
      }
      
      const resumeEl = $("#resume");
      // Check if resume is selected (mandatory since no default path set)
      if (!resumeEl || !resumeEl.files || !resumeEl.files[0]) {
        alert("Please select your Resume PDF/DOCX file in the 'Compose & Send' tab before tailoring.");
        return;
      }
      
      const originalText = btnAiTailor.textContent;
      btnAiTailor.textContent = "Generating...";
      btnAiTailor.disabled = true;
      
      const fd = new FormData();
      fd.append("jd", finalJd);
      
      const nameEl = $("#name");
      if (nameEl && nameEl.value) fd.append("name", nameEl.value.trim());
      
      fd.append("resume", resumeEl.files[0]);
      
      const res = await fetch("/api/generate-email", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to generate email");
      
      if (data.body) {
        const bodyEl = $("#body");
        if (bodyEl) {
             bodyEl.value = data.body;
             bodyEl.style.height = "auto";
             bodyEl.style.height = (bodyEl.scrollHeight) + "px";
        }
        
        if (typeof toast === "function") {
             toast("good", "Email Tailored", "Cover letter generated successfully!");
        } else {
             alert("Email tailored successfully!");
        }
      } else {
        alert("No email body returned.");
      }
      
    } catch (e) {
      console.error(e);
      alert("Error: " + (e.message || String(e)));
    } finally {
      if (btnAiTailor) {
        btnAiTailor.textContent = " AI Tailor";
        btnAiTailor.disabled = false;
      }
    }
  });
}

// --- RESUME BUILDER LOGIC ---
const tabResumeBuilder = $("#tabResumeBuilder");
const panelResumeBuilder = $("#panelResumeBuilder");

// Tab Switching Logic including new tab
if (tabResumeBuilder) {
  tabResumeBuilder.addEventListener("click", () => {
    // Hide all
    [panelSend, panelAts, panelHr, panelAuto, panelDefaults, panelSide].forEach(p => p && p.classList.add("hidden"));
    if (panelResumeBuilder) panelResumeBuilder.style.display = "block";
    
    // Deactivate tabs
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tabResumeBuilder.classList.add("active");
  });
  
  // Update existing tab listeners to hide ResumeBuilder panel
  [tabSend, tabAts, tabHr, tabAuto, tabDefaults].forEach(t => {
     if(t) {
        t.addEventListener("click", () => {
           if(panelResumeBuilder) panelResumeBuilder.style.display = "none";
        });
     }
  });
}

// Generate Resume Button
const rbGenerateBtn = $("#rbGenerateBtn");
if (rbGenerateBtn) {
  rbGenerateBtn.addEventListener("click", async () => {
    const jd = $("#rbJd")?.value?.trim();
    if (!jd) { alert("Please paste a Job Description first."); return; }
    
    const profile = {
       name: $("#rbName")?.value,
       email: $("#rbEmail")?.value,
       phone: $("#rbPhone")?.value,
       linkedin: $("#rbLinkedin")?.value,
       skills: $("#rbSkills")?.value,
       experience: $("#rbExperience")?.value,
       education: $("#rbEducation")?.value
    };
    
    if (!profile.name || !profile.experience) {
       alert("Please fill in at least Name and Experience in your Master Profile.");
       return;
    }
    
    const originalText = rbGenerateBtn.textContent;
    rbGenerateBtn.textContent = "Generating PDF...";
    rbGenerateBtn.disabled = true;
    
    try {
       const res = await fetch("/api/resume/build", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jd, profile })
       });
       
       if (!res.ok) throw new Error("Generation failed");
       
       const blob = await res.blob();
       const url = window.URL.createObjectURL(blob);
       const a = document.createElement("a");
       a.href = url;
       a.download = `Tailored_Resume_${profile.name.replace(/\s+/g,"_")}.pdf`;
       document.body.appendChild(a);
       a.click();
       a.remove();
       
    } catch (e) {
       alert("Error: " + e.message);
    } finally {
       rbGenerateBtn.textContent = originalText;
       rbGenerateBtn.disabled = false;
    }
  });
}
