const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("./config");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function generateTailoredEmail({ jd, resumeText, recipientName }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in .env");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `
    You are an expert career coach and professional writer. 
    Your task is to write a highly personalized and compelling job application email body.
    
    Job Description:
    """
    ${jd}
    """
    
    Applicant Resume Summary/Text:
    """
    ${resumeText}
    """
    
    Recipient Name: ${recipientName || "Hiring Team"}
    
    Guidelines:
    1. Keep it professional, concise, and enthusiastic.
    2. Highlight 2-3 key skills or experiences from the resume that directly match the job description.
    3. Mention why the applicant is a great fit for this specific role.
    4. Use a natural, human-like tone (avoid sounding like a bot).
    5. Do NOT include the subject line, only the email body.
    6. Do NOT include placeholders like [Company Name] if they are not provided; instead, use generic but professional phrasing.
    7. End with a professional sign-off but do NOT include the applicant's name at the end (it will be added by the system).
    
    Write only the email body text.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate email body using AI.");
  }
}

async function findHrNames({ domain }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in .env");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `
    You are a professional corporate researcher. 
    Your task is to identify 3-5 potential HR, Recruitment, or Talent Acquisition contacts for the company with the domain: ${domain}.
    
    Provide a list of 3-5 REAL people (names and titles). 
    Do NOT guess random names. If you are not high confident that these people work at ${domain} in HR/Recruitment roles, return an empty array [].
    
    Focus on finding:
    - HR Managers
    - Talent Acquisition Specialists
    - Recruitment Leads
    
    Return the results strictly as a JSON array of objects.
    Format: [{"name": "Full Name", "title": "Job Title"}]
    
    Return ONLY the JSON array, no other text.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    console.log(`AI Response for ${domain}:`, text);

    // Extract JSON if there's any markdown wrapping
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (parseErr) {
        console.error("Failed to parse matched JSON:", parseErr);
      }
    }
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini API Error (findHrNames):", error);
    return [];
  }
}

/**
 * Answer a chatbot question intelligently using AI
 * @param {string} question - The question asked by the chatbot
 * @param {object} userData - User data (DOB, experience, CTC, etc.)
 * @param {string} resumeText - Optional resume text for context
 * @returns {Promise<string>} - The answer to provide
 */
async function answerChatbotQuestion({ question, userData, resumeText = "" }) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not configured, using fallback answers");
    return null; // Will fall back to hardcoded logic
  }

  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `
    You are helping to auto-fill a job application chatbot on Naukri.com.
    
    The chatbot is asking: "${question}"
    
    User Information:
    - Date of Birth: ${userData.dateOfBirth || "Not provided"}
    - Total Experience: ${userData.totalExperience || "Not provided"} years
    - Expected CTC: ${userData.expectedCtc || "Not provided"}
    - Notice Period: ${userData.noticePeriod || "Not provided"}
    - Current Location: ${userData.currentLocation || "Not provided"}
    - Preferred Location: ${userData.preferredLocation || "Not provided"}
    
    ${resumeText ? `Resume Context:\n${resumeText.substring(0, 500)}` : ""}
    
    IMPORTANT RULES:
    1. Provide ONLY the answer text, nothing else
    2. Keep answers SHORT and DIRECT (1-10 words max)
    3. For dates, use DD/MM/YYYY format
    4. For numbers, provide only the number (no units unless asked)
    5. For yes/no questions, answer "Yes" or "No"
    6. If the information is not available in the user data, make a reasonable professional assumption
    7. Do NOT include explanations, just the answer
    
    Examples:
    Q: "What is your date of birth?" → "15/06/1998"
    Q: "How many years of experience?" → "3"
    Q: "Expected CTC?" → "1200000"
    Q: "Notice period?" → "30 Days"
    Q: "Are you willing to relocate?" → "Yes"
    
    Now answer this question: "${question}"
    
    Answer (SHORT, DIRECT):
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text().trim();

    // Clean up the answer (remove quotes, extra whitespace)
    return answer.replace(/^["']|["']$/g, '').trim();
  } catch (error) {
    console.error("Gemini API Error (answerChatbotQuestion):", error);
    return null; // Fall back to hardcoded logic
  }
}

module.exports = { generateTailoredEmail, findHrNames, answerChatbotQuestion };
