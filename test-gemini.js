const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    try {
        // The SDK doesn't have a direct listModels, but we can try to use the underlying fetch if needed.
        // However, let's try a different approach. Let's try to use 'gemini-1.5-flash-latest' or 'gemini-1.5-flash-001'.
        const models = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-pro'];
        for (const m of models) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.generateContent("hi");
                console.log(`Success with ${m}`);
                return;
            } catch (e) {
                console.log(`Failed with ${m}: ${e.message}`);
            }
        }
    } catch (e) {
        console.error("General error:", e.message);
    }
}

listModels();
