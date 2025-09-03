import { z } from "zod";

/** Generic numeric value + unit (keep units flexible in MVP). */
export const ValueUnitSchema = z.object({
  value: z.number(),
  unit: z.string(), // e.g., "mL", "L", "g", "M", "°C", "s"
});

export type ValueUnit = z.infer<typeof ValueUnitSchema>;
