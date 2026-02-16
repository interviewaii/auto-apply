const { GoogleGenerativeAI } = require("@google/generative-ai");
const puppeteer = require("puppeteer");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// AI Generation Step
let data = {
  summary: profile.experience,
  skills: profile.skills.split(',').map(s => s.trim()),
  experience_bullets: [profile.experience], // Fallback
};

if (process.env.GEMINI_API_KEY) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
            You are an expert Resume Writer.
            Target JD: "${jd.substring(0, 3000)}"
            Candidate: ${JSON.stringify(profile)}
            
            Rewrite the "Professional Summary" and "Skills" to match the JD keywords.
            Return ONLY a valid JSON object with this structure:
            {
              "summary": "...",
              "skills": ["...", "..."],
              "experience_bullets": ["...", "..."]
            }
            `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonStr = text.replace(/```json|```/g, "").trim();
    data = JSON.parse(jsonStr);
  } catch (e) {
    console.error("AI Resume Generation Failed (using fallback):", e.message);
  }
}

// Generate HTML
const html = `
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
        h1 { margin-bottom: 5px; text-transform: uppercase; font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 10px;}
        .contact { font-size: 14px; margin-bottom: 20px; color: #555; }
        .section-title { background: #eee; padding: 5px; margin-top: 20px; font-weight: bold; text-transform: uppercase; font-size: 14px; }
        .content { margin-top: 10px; font-size: 14px; line-height: 1.6; }
        .skills-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        ul { padding-left: 20px; margin: 0; }
        li { margin-bottom: 5px; }
      </style>
    </head>
    <body>
      <h1>${profile.name || "Candidate"}</h1>
      <div class="contact">
        ${profile.email || ""} | ${profile.phone || ""} | ${profile.linkedin || ""}
      </div>
      
      <div class="section-title">Professional Summary</div>
      <div class="content">${data.summary || profile.experience}</div>
      
      <div class="section-title">Skills</div>
      <div class="content skills-grid">
         ${(data.skills || []).map(s => `<div>• ${s}</div>`).join('')}
      </div>
      
      <div class="section-title">Experience</div>
      <div class="content">
        ${data.experience_bullets && Array.isArray(data.experience_bullets)
    ? `<ul>${data.experience_bullets.map(b => `<li>${b}</li>`).join('')}</ul>`
    : `<pre>${profile.experience}</pre>`}
      </div>
      
      <div class="section-title">Education</div>
      <div class="content">${profile.education || ""}</div>
    </body>
    </html>
    `;

// Convert to PDF
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'domcontentloaded' });
const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
await browser.close();

return pdfBuffer;

module.exports = { generateTailoredResume };
