const MODEL = "gemini-3.6-flash";

async function generateAIText({ system, messages, maxTokens = 2048 }) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const err = new Error("AI service is not configured on this server.");
    err.statusCode = 503;
    throw err;
  }

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey.trim()}`;

  const payload = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens },
  };

  if (system) {
    payload.systemInstruction = { parts: [{ text: system }] };
  }

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    const err = new Error(`Network error: ${netErr.message}`);
    err.statusCode = 502;
    throw err;
  }

  const data = await response.json();

  if (!response.ok) {
    console.log("GEMINI ERROR RESPONSE:", JSON.stringify(data, null, 2));
    const errMsg = data?.error?.message || response.statusText;
    const err = new Error(`Gemini API error: ${errMsg}`);
    err.statusCode = 502;
    throw err;
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const err = new Error("The AI returned an empty response.");
    err.statusCode = 502;
    throw err;
  }

  return text;
}

module.exports = { generateAIText };
