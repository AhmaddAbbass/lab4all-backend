import fetch from "node-fetch";
import { FreeStepRequest } from "../../schemas/free/stepio";
import { PostActionSchema, PostAction } from "../../schemas/free/postAction";

export async function getLLMPostAction(
  input: FreeStepRequest
): Promise<PostAction> {
  const prompt = `
You are a lab simulation engine.
Given:
- Action: ${input.action}
- History: ${JSON.stringify(input.history)}
- Current State: ${JSON.stringify(input.envState)}

Return ONLY valid JSON in this format:
{"update": {...}, "uiEffect": "..."}

Rules:
- "update" contains key-value pairs of state changes.
- "uiEffect" is optional and describes UI animation/effect.
- Do not include explanations.
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // fast + cheap, adjust as needed
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2, // keep deterministic
    }),
  });

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content?.trim();

  if (!rawText) {
    throw new Error("Empty response from LLM");
  }

  // Parse JSON
  let parsedJson;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`LLM returned invalid JSON: ${rawText}`);
  }

  // Validate against schema
  return PostActionSchema.parse(parsedJson);
}
