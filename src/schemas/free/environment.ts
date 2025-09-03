import { z } from "zod";
import { ValueUnitSchema } from "./valueUnit";

// ── leaf types ────────────────────────────────────────────────
export const LiquidSchema = z.object({
  volume: ValueUnitSchema,
  concentration: ValueUnitSchema.optional(),
  color: z.string().optional(),
});
export type Liquid = z.infer<typeof LiquidSchema>;

export const SolidSchema = z.object({
  mass: ValueUnitSchema,
  color: z.string().optional(),
  visualVolume: ValueUnitSchema.optional(), // UI-only
});
export type Solid = z.infer<typeof SolidSchema>;

export const AqueousSchema = z.object({
  concentration: ValueUnitSchema,
  color: z.string().optional(),
});
export type Aqueous = z.infer<typeof AqueousSchema>;

export const ToolSchema = z.object({
  id: z.string(),
  type: z.string(), // "pHmeter" | "thermometer" | …
  envId: z.string(),
  property: z.string(), // "pH" | "temperature" | …
  reading: z.union([z.number(), ValueUnitSchema]),
});
export type Tool = z.infer<typeof ToolSchema>;

// ── Environment ───────────────────────────────────────────────
export const EnvironmentSchema = z.object({
  id: z.string(), // "Beaker1"
  type: z.string(), // "Beaker" | "Flask" | …
  properties: z.object({
    temperature: ValueUnitSchema,
    pH: z.number().min(0).max(14),
    instants: z
      .object({
        sound: z
          .object({
            active: z.boolean(),
            level: z.number(),
          })
          .optional(),
        gas: z
          .object({
            compound: z.string(),
            volume: ValueUnitSchema,
            color: z.string().optional(),
          })
          .optional(),
      })
      .partial()
      .optional(),
  }),
  contents: z.object({
    liquids: z.record(LiquidSchema),
    solids: z.record(SolidSchema),
    aqueous: z.record(AqueousSchema),
  }),
  attachedTools: z.array(z.string()).optional(),
});
export type Environment = z.infer<typeof EnvironmentSchema>;
