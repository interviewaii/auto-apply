const { GoogleGenerativeAI } = require("@google/generative-ai");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Use AI to tailor resume content to the given JD.
 * Returns { summary, skills[], experience_bullets[], project_bullets[] }
 */
async function tailorContentWithAI({ jd, profile }) {
  let data = {
    summary: profile.experience || "Experienced professional.",
    skills: profile.skills ? profile.skills.split(",").map((s) => s.trim()) : [],
    experience_bullets: [profile.experience || ""],
    project_bullets: profile.projects ? profile.projects.split("\n").map(s => s.trim()).filter(Boolean) : [],
  };

  if (process.env.GEMINI_API_KEY) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `
You are an expert Resume Writer.
Target JD: "${jd.substring(0, 3000)}"
Candidate Profile: ${JSON.stringify(profile)}

Task:
1. Rewrite "Professional Summary" to match JD keywords (2-3 sentences max).
2. Select and list the most relevant skills from the candidate's skills that match the JD (8-12 items).
3. Rewrite 3-5 "Experience" bullet points from candidate's history that align with the JD.
4. From the candidate's projects, select and rewrite 2-3 most relevant projects as bullet points in format "ProjectName: description highlighting JD-relevant tech/outcome". If no projects provided, return empty array.

Return ONLY a valid JSON object:
{
  "summary": "...",
  "skills": ["...", "..."],
  "experience_bullets": ["...", "..."],
  "project_bullets": ["...", "..."]
}
`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonStr = text.replace(/```json|```/g, "").trim();
      data = JSON.parse(jsonStr);
    } catch (e) {
      console.error("[ResumeBuilder] AI tailoring failed (using fallback):", e.message);
    }
  }
  return data;
}

/**
 * Build HTML string for the resume.
 * Uses compact CSS with page-break-inside:avoid on sections.
 */
function buildResumeHTML(profile, data) {
  return `
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Helvetica', 'Arial', sans-serif;
      padding: 28px 32px;
      color: #222;
      line-height: 1.45;
      margin: 0;
    }
    h1 {
      margin: 0 0 3px 0;
      text-transform: uppercase;
      font-size: 22px;
      border-bottom: 2px solid #333;
      padding-bottom: 7px;
      letter-spacing: 1px;
    }
    .contact {
      font-size: 12.5px;
      margin-bottom: 10px;
      color: #555;
    }
    .section {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .section-title {
      background: #eee;
      padding: 5px 8px;
      margin-top: 14px;
      margin-bottom: 6px;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 12.5px;
      border-left: 4px solid #333;
    }
    .content {
      font-size: 12.5px;
      margin-top: 0;
    }
    .skills-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 12px;
    }
    ul { padding-left: 18px; margin: 0; }
    li { margin-bottom: 3px; }
  </style>
</head>
<body>
  <h1>${profile.name || "Candidate"}</h1>
  <div class="contact">
    ${[profile.email, profile.phone, profile.linkedin].filter(Boolean).join(" &nbsp;|&nbsp; ")}
  </div>

  <div class="section">
    <div class="section-title">Professional Summary</div>
    <div class="content">${data.summary || profile.experience || ""}</div>
  </div>

  <div class="section">
    <div class="section-title">Skills</div>
    <div class="content skills-grid">
      ${(data.skills || []).map((s) => `<div>&#8226; ${s}</div>`).join("")}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Experience</div>
    <div class="content">
      ${data.experience_bullets && Array.isArray(data.experience_bullets) && data.experience_bullets.length > 0
      ? `<ul>${data.experience_bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`
      : `<div style="white-space:pre-wrap;">${profile.experience || ""}</div>`
    }
    </div>
  </div>

  ${(data.project_bullets && data.project_bullets.length > 0) || profile.projects ? `
  <div class="section">
    <div class="section-title">Projects</div>
    <div class="content">
      <ul>${(data.project_bullets && data.project_bullets.length > 0
        ? data.project_bullets
        : (profile.projects || "").split("\n").map(s => s.trim()).filter(Boolean)
      ).map(b => `<li>${b}</li>`).join("")}</ul>
    </div>
  </div>` : ""}

  ${profile.education ? `
  <div class="section">
    <div class="section-title">Education</div>
    <div class="content">${profile.education}</div>
  </div>` : ""}

</body>
</html>`;
}

/**
 * Generate a tailored resume PDF based on JD and Profile
 * @param {object} params - { jd, profile }
 * @returns {Promise<Buffer>} - PDF Buffer
 */
async function generateTailoredResumePDF({ jd, profile }) {
  if (!jd || !profile) {
    throw new Error("Missing JD or Profile data for resume generation");
  }

  const data = await tailorContentWithAI({ jd, profile });
  const html = buildResumeHTML(profile, data);

  let browser = null;
  try {
    let execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (execPath && !fs.existsSync(execPath)) {
      console.warn(`[ResumeBuilder] Custom Chrome path not found: ${execPath}. Using bundled Chrome.`);
      execPath = undefined;
    }

    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    const page = await browser.newPage();
    // Set A4 viewport so layout matches the PDF size exactly
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Measure actual rendered content height vs A4 page height (1123px at 96dpi)
    // Then compute a scale so content always fits on exactly one page
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const A4_HEIGHT_PX = 1123; // A4 at 96dpi
    const MIN_SCALE = 0.62;
    const MAX_SCALE = 1.0;
    let scale = Math.min(MAX_SCALE, A4_HEIGHT_PX / bodyHeight);
    scale = Math.max(MIN_SCALE, scale);
    // Round to 2 decimal places
    scale = Math.round(scale * 100) / 100;
    console.log(`[ResumeBuilder] content height=${bodyHeight}px → scale=${scale}`);

    const pdfData = await page.pdf({
      format: "A4",
      printBackground: true,
      scale,
      margin: { top: "0.5cm", bottom: "0.5cm", left: "0.5cm", right: "0.5cm" },
    });

    // Puppeteer v22+ returns Uint8Array — convert to Node.js Buffer
    return Buffer.from(pdfData);
  } catch (err) {
    console.error("[ResumeBuilder] Puppeteer PDF generation failed:", err.message);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Generate a tailored resume DOCX based on JD and Profile
 * @param {object} params - { jd, profile }
 * @returns {Promise<Buffer>} - DOCX Buffer
 */
async function generateTailoredResumeDOCX({ jd, profile }) {
  if (!jd || !profile) {
    throw new Error("Missing JD or Profile data for resume generation");
  }

  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    ShadingType,
    Table,
    TableRow,
    TableCell,
    WidthType,
  } = require("docx");

  const data = await tailorContentWithAI({ jd, profile });

  // Helper to create section heading paragraph
  const sectionHeading = (text) =>
    new Paragraph({
      text: text.toUpperCase(),
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333" },
      },
    });

  const children = [];

  // Name
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: (profile.name || "Candidate").toUpperCase(),
          bold: true,
          size: 48, // 24pt
          color: "222222",
        }),
      ],
      spacing: { after: 100 },
    })
  );

  // Contact info
  const contactParts = [profile.email, profile.phone, profile.linkedin].filter(Boolean);
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: contactParts.join(" | "),
          size: 22,
          color: "555555",
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Professional Summary
  children.push(sectionHeading("Professional Summary"));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: data.summary || profile.experience || "", size: 22 })],
      spacing: { after: 150 },
    })
  );

  // Skills
  children.push(sectionHeading("Skills"));
  const skills = data.skills || [];
  for (let i = 0; i < skills.length; i += 2) {
    const left = skills[i] ? `• ${skills[i]}` : "";
    const right = skills[i + 1] ? `• ${skills[i + 1]}` : "";
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: left.padEnd(40, " "), size: 22 }),
          new TextRun({ text: right, size: 22 }),
        ],
        spacing: { after: 60 },
      })
    );
  }

  // Experience
  children.push(sectionHeading("Experience"));
  const bullets = data.experience_bullets && Array.isArray(data.experience_bullets) ? data.experience_bullets : [];
  if (bullets.length > 0) {
    for (const bullet of bullets) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `• ${bullet}`, size: 22 })],
          spacing: { after: 80 },
        })
      );
    }
  } else if (profile.experience) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: profile.experience, size: 22 })],
        spacing: { after: 80 },
      })
    );
  }

  // Education
  if (profile.education) {
    children.push(sectionHeading("Education"));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: profile.education, size: 22 })],
        spacing: { after: 80 },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 }, // 0.5 inch margins
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

// Keep backward compat export
async function generateTailoredResume(params) {
  return generateTailoredResumePDF(params);
}

module.exports = {
  generateTailoredResume,
  generateTailoredResumePDF,
  generateTailoredResumeDOCX,
};
