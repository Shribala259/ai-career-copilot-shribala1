// Runs on Vercel's server. Your API key stays here and is never sent to the browser.

// Update this if Google renames the model (check Google AI Studio)
const MODEL = "gemini-3.8-flash";

// Edit this prompt (Steps 4 and 5). It now lives on the server.
const SYSTEM_PROMPT = `
ROLE: You are a career advisor who helps fresh graduates land their first tech job, focusing on internships, projects, and entry-level skills.

TASK: Analyze the resume against the job description and judge how well they match.

OUTPUT FORMAT: Return ONLY valid JSON, no markdown, with exactly these keys:
{
  "ats_score": <number from 0 to 100>,
  "summary": "<2 sentence overall assessment>",
  "matched_keywords": ["<skill or keyword found in both>"],
  "missing_keywords": ["<important keyword in the job description but not in the resume>"],
  "improvements": ["<specific, actionable change to the resume>"]
}

RULES:
- Be specific, not generic. Refer to actual content from the resume.
- Never invent numbers or achievements. If suggesting a metric, tell the candidate to add it only if they have a real one.
- Do not include example percentages or numbers in suggestions.
- Never suggest adding skills the candidate does not appear to have.
- Give at most 8 items in each list.
- Keep every item short (under 20 words).
`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });
  }

  const { resume, job } = req.body || {};
  if (!resume || !job) {
    return res.status(400).json({ error: "Resume and job description are required" });
  }
  if (String(resume).length > 15000 || String(job).length > 15000) {
    return res.status(400).json({ error: "Text is too long (max 15000 characters each)" });
  }

  try {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      MODEL + ":generateContent";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: SYSTEM_PROMPT + "\n\nRESUME:\n" + resume +
                  "\n\nJOB DESCRIPTION:\n" + job
          }]
        }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: (data.error && data.error.message) || "Gemini request failed"
      });
    }

    const raw = data.candidates[0].content.parts[0].text;
    const clean = raw.replace(/```json|```/g, "").trim();
    return res.status(200).json(JSON.parse(clean));
  } catch (err) {
    return res.status(500).json({ error: "Could not get a valid response: " + err.message });
  }
};
