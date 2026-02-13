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
  return String(md || "")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/^```\w*\n?/m, "").replace(/\n?```$/m, ""))
    .replace(/^\s*#+\s*/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\r/g, "")
    .trim();
}

function listMdFiles(dir, { ignoreDirs }) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (ignoreDirs.has(e.name)) continue;
      out.push(...listMdFiles(p, { ignoreDirs }));
      continue;
    }
    if (e.isFile() && e.name.toLowerCase().endsWith(".md")) out.push(p);
  }
  return out;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toSafePdfPath(outRoot, repoRoot, mdPath) {
  const rel = path.relative(repoRoot, mdPath);
  const relNoExt = rel.replace(/\.md$/i, "");
  const outPath = path.join(outRoot, `${relNoExt}.pdf`);
  return outPath;
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const outRoot = path.resolve(repoRoot, "docs", "md-pdfs");
  ensureDir(outRoot);

  const ignoreDirs = new Set(["node_modules", ".git", ".cursor", "dist", "build"]);

  const mdFiles = listMdFiles(repoRoot, { ignoreDirs })
    // don’t re-convert anything inside output folder
    .filter((p) => !p.includes(path.join("docs", "md-pdfs")));

  if (!mdFiles.length) {
    console.log("No .md files found.");
    return;
  }

  for (const mdPath of mdFiles) {
    const md = fs.readFileSync(mdPath, "utf8");
    const txt = stripMarkdown(md);

    const rel = path.relative(repoRoot, mdPath);
    const header = [
      "MARKDOWN EXPORT",
      `Source: ${rel}`,
      `Generated at: ${new Date().toISOString()}`,
      "=".repeat(70),
      "",
    ].join("\n");

    const outPath = toSafePdfPath(outRoot, repoRoot, mdPath);
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, textToSimplePdfBuffer(`${header}${txt}\n`));
    console.log(`Wrote: ${outPath}`);
  }
}

main();

