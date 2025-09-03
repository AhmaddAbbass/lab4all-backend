import { z } from "zod";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import OpenAI from "openai";

import {
  EnvironmentSchema,
  type Environment,
} from "../../schemas/free/environment";
import { ActionSchema, type Action } from "../../schemas/free/action";
import {
  PostActionSchema,
  type PostAction,
  type UIEvent,
} from "../../schemas/free/postAction";

/** Public API */
export type LlmStepArgs = {
  env: Environment;
  action: Action;
  history: Array<{ action: Action; result: PostAction; timestamp: string }>;
};

export type LlmStepOut = {
  postAction: PostAction;
  uiEvents: UIEvent[];
  tokensIn: number;
  tokensOut: number;
};

/** Main entry */
export async function llmStep(args: LlmStepArgs): Promise<LlmStepOut> {
  // 1) Defensive validation (handler already validates, this is belt & suspenders)
  const env = EnvironmentSchema.parse(args.env);
  const action = ActionSchema.parse(args.action);
  const history = z
    .array(
      z.object({
        action: ActionSchema,
        result: PostActionSchema,
        timestamp: z.string(),
      })
    )
    .parse(args.history)
    .slice(-3); // last 3 only

  // 2) Build prompt
  const prompt = buildPrompt({ env, action, history });

  // 3) Call OpenAI
  const { completion, promptTokens, completionTokens } = await callOpenAI(
    prompt
  );

  // 4) Extract JSON & validate
  const raw = extractJson(completion);
  const postAction = normalizeClamp(raw);

  // 5) Derive extra UI events so FE never misses critical visuals
  const uiEvents = deriveUiEvents({ before: env, diff: postAction });

  return {
    postAction,
    uiEvents,
    tokensIn: promptTokens,
    tokensOut: completionTokens,
  };
}

/* ───────────────────────── OpenAI call ───────────────────────── */

async function callOpenAI(systemAndUser: { system: string; user: string }) {
  const secretArn = process.env.LLM_SECRET_ARN!;
  const model = process.env.LLM_MODEL_ID || "gpt-4o-mini";

  const sm = new SecretsManagerClient({});
  const sec = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const apiKey =
    sec.SecretString && JSON.parse(sec.SecretString).OPENAI_API_KEY
      ? JSON.parse(sec.SecretString).OPENAI_API_KEY
      : undefined;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY missing in the specified secret");
  }

  const openai = new OpenAI({ apiKey });

  const resp = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemAndUser.system },
      { role: "user", content: systemAndUser.user },
    ],
  });

  const content = resp.choices?.[0]?.message?.content ?? "{}";
  const usage = resp.usage ?? { prompt_tokens: 0, completion_tokens: 0 };

  return {
    completion: content,
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
  };
}

/* ───────────────────────── Prompt ───────────────────────── */

function buildPrompt(input: {
  env: Environment;
  action: Action;
  history: Array<{ action: Action; result: PostAction; timestamp: string }>;
}) {
  const system = [
    "You are a Chemistry Lab UI simulator for a student-facing web app.",
    "This is *UI-first*: produce plausible visual outcomes, NOT real stoichiometry.",
    "",
    "OUTPUT FORMAT:",
    "- Return ONLY a JSON object conforming to this shape (TypeScript):",
    "  interface PostAction {",
    "    environment?: { id: string } & {",
    "      type?: string;",
    "      properties?: { pH?: number; temperature?: { value: number; unit: string }; instants?: any };",
    "      contents?: {",
    "        liquids?: Record<string, { volume: { value: number; unit: string }; color?: string }>; ",
    "        solids?: Record<string, { mass?: { value: number; unit: string }; color?: string }>; ",
    "        aqueous?: Record<string, { concentration: { value: number; unit: string } }>; ",
    "      };",
    "      attachedTools?: string[];",
    "    };",
    "    tools?: Record<string, { reading?: number; status?: 'on'|'off' } & Record<string, unknown>>;",
    "    uiEvents?: Array<{ path: string; effect: string; payload?: unknown }>;",
    "  }",
    "",
    "CRITICAL RULES:",
    "- Do NOT invent environments or tools that weren't provided.",
    "- Produce a MINIMAL DIFF: only include fields that actually change.",
    "- Clamp pH to [0,14]. No NaN, no negative volumes/masses.",
    "- Mirror tool readings if their underlying property changes (e.g., pHmeter).",
    "- Keep it consistent and plausible:",
    "  • Adding acid (e.g., HCl) → pH decreases; add H+ and its anion to aqueous.",
    "  • Adding base (e.g., NaOH) → pH increases; add OH- and its cation to aqueous.",
    "  • Carbonate + acid → transient CO2 in instants.gas; pH nudges acidic.",
    "  • Overdose solids → leave excess in contents.solids with mass & color.",
    "  • Heat → raise temperature slightly (unless already very high).",
    "  • Stir → no chemistry change; you may clear instants.gas.",
    "- Provide uiEvents that the UI can act on: updatePHMeter, spawnGasBubbles, showPrecipitate, flashBeaker, etc.",
    "- Output valid JSON only, no prose or markdown.",
  ].join("\n");

  const user = JSON.stringify(
    {
      instruction:
        "Given the current environment snapshot, the new student action, and the last steps, produce a minimal PostAction diff suitable for UI updates.",
      constraints: {
        clampPH: [0, 14],
        minimalDiff: true,
        doNotInvent: true,
      },
      context: {
        env: input.env,
        lastActions: input.history.map((h) => h.action),
        lastDiffs: input.history.map((h) => h.result),
      },
      newAction: input.action,
      examples: [
        {
          when: "Adding 20 mL of 0.1 M HCl to neutral water in Beaker1 with a pH meter attached.",
          output: {
            environment: {
              id: "Beaker1",
              properties: { pH: 3 },
              contents: {
                aqueous: {
                  "H+": { concentration: { value: 0.1, unit: "M" } },
                  "Cl-": { concentration: { value: 0.1, unit: "M" } },
                },
              },
            },
            tools: { pHmeter1: { reading: 3 } },
            uiEvents: [
              {
                path: "properties.pH",
                effect: "updatePHMeter",
                payload: { reading: 3 },
              },
            ],
          },
        },
      ],
    },
    null,
    2
  );

  return { system, user };
}

/* ───────────────────────── JSON handling & normalization ───────────────────────── */

function extractJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(s.slice(start, end + 1));
    }
    throw new Error("LLM response did not contain valid JSON.");
  }
}

function normalizeClamp(raw: unknown): PostAction {
  // Validate full shape (environment.diff requires id if present)
  const parsed = PostActionSchema.parse(raw);

  // Clamp pH if provided
  const pH = parsed.environment?.properties?.pH;
  if (typeof pH === "number") {
    parsed.environment!.properties!.pH = clamp(pH, 0, 14);
  }

  // Optional guards: zero out invalid negatives
  const liquids = parsed.environment?.contents?.liquids;
  if (liquids) {
    for (const k of Object.keys(liquids)) {
      const v = liquids[k]?.volume?.value;
      if (typeof v === "number" && v < 0) liquids[k].volume.value = 0;
    }
  }
  const solids = parsed.environment?.contents?.solids;
  if (solids) {
    for (const k of Object.keys(solids)) {
      const v = solids[k]?.mass?.value;
      if (typeof v === "number" && v < 0) solids[k]!.mass!.value = 0;
    }
  }

  // Ensure uiEvents exists for FE convenience
  if (!Array.isArray(parsed.uiEvents)) parsed.uiEvents = [];

  return parsed;
}

function clamp(x: number, lo: number, hi: number) {
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

/* ───────────────────────── UI Events derivation ───────────────────────── */

function deriveUiEvents(input: {
  before: Environment;
  diff: PostAction;
}): UIEvent[] {
  const out: UIEvent[] = Array.isArray(input.diff.uiEvents)
    ? [...input.diff.uiEvents]
    : [];

  // Add pH update if pH changed and no explicit event already exists
  const beforePH = input.before.properties?.pH;
  const afterPH = input.diff.environment?.properties?.pH;
  if (
    typeof beforePH === "number" &&
    typeof afterPH === "number" &&
    beforePH !== afterPH
  ) {
    const hasPHEvent = out.some((e) => e.effect === "updatePHMeter");
    if (!hasPHEvent) {
      out.push({
        path: "properties.pH",
        effect: "updatePHMeter",
        payload: { reading: afterPH },
      });
    }
  }

  // If gas instants present → bubbles (avoid duplicates)
  const gas = input.diff.environment?.properties?.instants as any;
  if (gas && typeof gas === "object" && gas.gas) {
    const hasBubbles = out.some((e) => e.effect === "spawnGasBubbles");
    if (!hasBubbles) {
      out.push({
        path: "properties.instants.gas",
        effect: "spawnGasBubbles",
        payload: { compound: gas.gas.compound, intensity: gas.gas.volume },
      });
    }
  }

  // If solids added → precipitate
  const solids = input.diff.environment?.contents?.solids;
  if (solids && Object.keys(solids).length > 0) {
    const hasPrec = out.some((e) => e.effect === "showPrecipitate");
    if (!hasPrec) {
      out.push({
        path: "contents.solids",
        effect: "showPrecipitate",
        payload: { solids },
      });
    }
  }

  return out;
}
