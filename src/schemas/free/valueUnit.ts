import { z } from "zod";

export const ValueUnitSchema = z.object({
  value: z.number(),
  unit: z.string().min(1), // "mL", "g", "°C", "M", …
});
export type ValueUnit = z.infer<typeof ValueUnitSchema>;
