import { z } from "zod";
import { ValueUnitSchema } from "./valueUnit";

/** Student actions (MVP). Discriminated by 'type'. */

const AddActionSchema = z.object({
  type: z.literal("add"),
  material: z.string(),                // e.g., "HCl", "CaCO3", "Water"
  amount: ValueUnitSchema,             // e.g., { value: 20, unit: "mL" }
  target: z.string(),                  // environment id
});

const HeatActionSchema = z.object({
  type: z.literal("heat"),
  target: z.string(),
  delta: ValueUnitSchema.optional(),   // { value: 10, unit: "°C" }
  to: ValueUnitSchema.optional(),      // { value: 60, unit: "°C" }
});

const StirActionSchema = z.object({
  type: z.literal("stir"),
  target: z.string(),
  duration: ValueUnitSchema.optional(),                 // { value: 10, unit: "s" }
  intensity: z.enum(["low", "medium", "high"]).optional(),
});

export const ActionSchema = z
  .discriminatedUnion("type", [AddActionSchema, HeatActionSchema, StirActionSchema])
  .superRefine((v, ctx) => {
    if (v.type === "heat" && !v.delta && !v.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either 'delta' or 'to' for heat action.",
        path: ["delta"], // anchor somewhere reasonable
      });
    }
  });

export type Action = z.infer<typeof ActionSchema>;