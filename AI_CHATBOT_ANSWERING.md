# AI-Powered Chatbot Question Answering

## Overview
The Naukri auto-apply bot now uses **Gemini AI** to intelligently answer **any question** asked by the job application chatbot, even questions not in the predefined list.

## How It Works

### 1. **AI-First Approach**
When the chatbot asks a question, the bot:
1. Sends the question to Gemini AI
2. Provides your user data (DOB, experience, CTC, etc.) as context
3. Gets an intelligent, contextual answer
4. Types the answer automatically

### 2. **Fallback System**
If AI fails or is unavailable:
- Falls back to hardcoded pattern matching
- Uses predefined answers for common questions
- Ensures the application continues even without AI

## Supported Questions

### AI Can Answer (Examples):
- ✅ "How many years of experience do you have in Java?"
- ✅ "What is your current CTC?"
- ✅ "Are you willing to relocate?"
- ✅ "What is your notice period?"
- ✅ "Do you have experience with Spring Boot?"
- ✅ "What technologies are you proficient in?"
- ✅ **Any other question based on your profile**

### Hardcoded Fallbacks:
- Date of Birth
- Total Experience
- Expected CTC
- Notice Period
- Current Location
- Preferred Location
- Gender
- Interest Confirmation (Yes/No)

## Configuration

### Required:
Make sure you have `GEMINI_API_KEY` in your `.env` file:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### User Data (in UI Settings):
The AI uses this data to answer questions:
- `dateOfBirth`: Your date of birth (DD/MM/YYYY)
- `totalExperience`: Years of experience
- `expectedCtc`: Expected salary (in numbers)
- `noticePeriod`: Notice period (e.g., "30 Days")
- `currentLocation`: Current city
- `preferredLocation`: Preferred work locations

## AI Answer Rules

The AI is instructed to:
1. **Keep answers SHORT** (1-10 words max)
2. **Be DIRECT** - no explanations
3. **Use proper formats**:
   - Dates: DD/MM/YYYY
   - Numbers: Just the number
   - Yes/No: "Yes" or "No"
4. **Make reasonable assumptions** if data is missing
5. **Stay professional**

## Examples

### Question: "How many years of experience do you have in Java?"
**AI Answer**: "3"

### Question: "What is your expected CTC?"
**AI Answer**: "1200000"

### Question: "Are you willing to relocate to Bangalore?"
**AI Answer**: "Yes"

### Question: "What is your notice period?"
**AI Answer**: "30 Days"

### Question: "Do you have Spring Boot experience?"
**AI Answer**: "Yes" (based on resume/profile)

## Benefits

### ✅ **Handles ANY Question**
- No need to manually add every possible question type
- Works with custom/unique questions from different companies

### ✅ **Context-Aware**
- Uses your actual profile data
- Can reference resume information
- Gives appropriate professional answers

### ✅ **Reliable Fallback**
- If AI fails, uses hardcoded patterns
- Ensures application continues smoothly

### ✅ **Smart & Adaptive**
- Learns from your data
- Adjusts answers based on context
- Professional and concise responses

## Logs

You'll see these in the terminal:

```
[Naukri] Asking AI to answer: "How many years of experience do you have in Java?..."
[Naukri] AI provided answer: "3"
[Naukri] Chatbot Question Type: "AI-Generated"
[Naukri] Answering: "3"
[Naukri] Verified typed: "3"
```

If AI fails:
```
[Naukri] AI answer failed: [error], using fallback
[Naukri] Chatbot Question Type: "Experience"
[Naukri] Answering: "3"
```

## Troubleshooting

### AI Not Working?
1. Check if `GEMINI_API_KEY` is set in `.env`
2. Verify the API key is valid
3. Check internet connection
4. The bot will automatically fall back to hardcoded patterns

### Wrong Answers?
1. Update your user data in UI Settings
2. Ensure data is in the correct format
3. The AI learns from your provided information

### Too Long Answers?
- AI is instructed to keep answers under 10 words
- If it gives long answers, they'll be rejected
- Falls back to hardcoded patterns

## Future Enhancements

Potential improvements:
- [ ] Pass resume text for better context
- [ ] Learn from previous successful answers
- [ ] Support for multiple languages
- [ ] Custom answer templates
- [ ] Answer validation and retry logic

## Technical Details

### Files Modified:
1. `backend/src/ai.js` - Added `answerChatbotQuestion()` function
2. `backend/src/appliers/naukri-applier.js` - Integrated AI answering

### AI Model:
- Uses: `gemini-flash-latest`
- Fast responses (< 2 seconds)
- Cost-effective for high-volume applications

### Error Handling:
- Try-catch around AI calls
- Graceful fallback to patterns
- Logs all errors for debugging
- Never blocks the application flow

---

**Note**: This feature requires a valid Gemini API key. Get one free at: https://makersuite.google.com/app/apikey
