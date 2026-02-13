const fs = require("fs");
const path = require("path");

// Minimal PDF generator (Helvetica) adapted from backend/src/ui-server.js
function pdfEscape(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function textToSimplePdfBuffer(text) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .flatMap((l) => {
      const out = [];
      let s = l;
      // crude wrap at ~95 chars
      while (s.length > 95) {
        out.push(s.slice(0, 95));
        s = s.slice(95);
      }
      out.push(s);
      return out;
    });

  const pageHeight = 792; // 11in * 72
  const pageWidth = 612; // 8.5in * 72
  const margin = 48;
  const lineHeight = 12;
  const usable = pageHeight - margin * 2;
  const linesPerPage = Math.max(1, Math.floor(usable / lineHeight));

  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) pages.push(lines.slice(i, i + linesPerPage));

  const objects = [];
  const offsets = [];
  const addObj = (s) => {
    offsets.push(null);
    objects.push(s);
    return objects.length; // 1-based obj number
  };

  const fontObj = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const pageObjs = [];
  const contentObjs = [];

  for (const pLines of pages) {
    let y = pageHeight - margin;
    const contentLines = [];
    contentLines.push("BT");
    contentLines.push("/F1 10 Tf");
    contentLines.push("1 0 0 1 0 0 Tm");
    for (const l of pLines) {
      contentLines.push(`${margin} ${y} Td`);
      contentLines.push(`(${pdfEscape(l)}) Tj`);
      contentLines.push(`${-margin} 0 Td`);
      y -= lineHeight;
    }
    contentLines.push("ET");

    const stream = contentLines.join("\n");
    const contentObj = addObj(
      `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    );
    contentObjs.push(contentObj);
  }

  const pagesKids = [];
  for (let i = 0; i < pages.length; i++) {
    const contentObj = contentObjs[i];
    const pageObj = addObj(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${contentObj} 0 R >>`,
    );
    pageObjs.push(pageObj);
    pagesKids.push(`${pageObj} 0 R`);
  }

  const pagesObjNum = addObj(`<< /Type /Pages /Kids [${pagesKids.join(" ")}] /Count ${pagesKids.length} >>`);

  // Patch Parent refs
  for (const objNum of pageObjs) {
    const idx = objNum - 1;
    objects[idx] = objects[idx].replace("/Parent 0 0 R", `/Parent ${pagesObjNum} 0 R`);
  }

  const catalogObj = addObj(`<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  for (let i = 0; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, "utf8");
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 0; i < offsets.length; i++) {
    const off = String(offsets[i]).padStart(10, "0");
    pdf += `${off} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

function stripMarkdown(md) {
  // Keep it simple: remove fences and most formatting, preserve headings as text.
  return String(md || "")
    .replace(/```[\s\S]*?```/g, (m) => {
      // keep code but without fences
      return m.replace(/^```\w*\n?/m, "").replace(/\n?```$/m, "");
    })
    .replace(/^\s*#+\s*/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\r/g, "")
    .trim();
}

function readDoc(p) {
  return fs.readFileSync(p, "utf8");
}

function buildCombinedText(docPaths) {
  const parts = [];
  parts.push("JOB MAILER — PROJECT DOCUMENTATION");
  parts.push("Generated from docs/*.md");
  parts.push(`Generated at: ${new Date().toISOString()}`);
  parts.push("=".repeat(70));
  parts.push("");

  for (const p of docPaths) {
    const base = path.basename(p);
    const md = readDoc(p);
    const txt = stripMarkdown(md);
    parts.push("=".repeat(70));
    parts.push(`FILE: ${base}`);
    parts.push("=".repeat(70));
    parts.push(txt);
    parts.push("");
  }

  return parts.join("\n");
}

function main() {
  const root = path.resolve(__dirname, "..");
  const docsDir = path.resolve(root, "docs");

  const docPaths = [
    path.resolve(docsDir, "01_TECHNICAL_DOC.md"),
    path.resolve(docsDir, "02_FLOW_DOC.md"),
    path.resolve(docsDir, "03_INTERVIEW_EXPLANATION.md"),
    path.resolve(docsDir, "04_QUICKSTART.md"),
    path.resolve(docsDir, "05_API_REFERENCE.md"),
  ];

  for (const p of docPaths) {
    if (!fs.existsSync(p)) throw new Error(`Missing doc file: ${p}`);
  }

  const combined = buildCombinedText(docPaths);
  const pdf = textToSimplePdfBuffer(combined);

  const outPath = path.resolve(docsDir, "JobMailer_Project_Docs.pdf");
  fs.writeFileSync(outPath, pdf);

  const outTxt = path.resolve(docsDir, "JobMailer_Project_Docs.txt");
  fs.writeFileSync(outTxt, combined, "utf8");

  console.log(`Wrote: ${outPath}`);
  console.log(`Wrote: ${outTxt}`);
}

main();

