const { GoogleGenerativeAI } = require("@google/generative-ai");
const puppeteer = require("puppeteer");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateTailoredResume({ jd, profile }) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
    You are an expert Resume Writer and ATS Optimizer.
    I will provide a Target Job Description (JD) and a Candidate Profile.
    
    Your task is to REWRITE the candidate's "Professional Summary" and "Skills" section to perfectly match the JD keywords, 
    while keeping the Experience and Education truthful but highlighted relevantly.
    
    Target JD:
    "${jd.substring(0, 3000)}"
    
    Candidate Profile:
    Name: ${profile.name}
    Email: ${profile.email}
    Phone: ${profile.phone}
    LinkedIn: ${profile.linkedin}
    Skills: ${profile.skills}
    Experience: ${profile.experience}
    Education: ${profile.education}
    
    Output a JSON object with this structure:
    {
      "summary": "Strong professional summary tailored to the JD...",
      "skills": ["Skill 1", "Skill 2" ...],
      "experience_bullets": ["Refined bullet 1", "Refined bullet 2"...] 
    }
  `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from markdown code block if present
    let jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
    let data;
    try {
        data = JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse AI response:", text);
        throw new Error("AI failed to generate structural data.");
    }

    // Generate HTML
    const html = `
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
        h1 { margin-bottom: 5px; text-transform: uppercase; font-size: 24px; }
        .contact { font-size: 14px; margin-bottom: 20px; color: #555; }
        .section-title { border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 20px; font-weight: bold; text-transform: uppercase; }
        .content { margin-top: 10px; font-size: 14px; line-height: 1.6; }
        .skills-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      </style>
    </head>
    <body>
      <h1>${profile.name}</h1>
      <div class="contact">
        ${profile.email} | ${profile.phone} | <a href="${profile.linkedin}">${profile.linkedin}</a>
      </div>
      
      <div class="section-title">Professional Summary</div>
      <div class="content">${data.summary}</div>
      
      <div class="section-title">Skills</div>
      <div class="content skills-grid">
         ${data.skills.map(s => `<div>• ${s}</div>`).join('')}
      </div>
      
      <div class="section-title">Experience</div>
      <div class="content">
        ${data.experience_bullets ? `<ul>${data.experience_bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : `<pre>${profile.experience}</pre>`}
      </div>
      
      <div class="section-title">Education</div>
      <div class="content">${profile.education}</div>
    </body>
    </html>
  `;

    // Convert to PDF
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    return pdfBuffer;
}

module.exports = { generateTailoredResume };
