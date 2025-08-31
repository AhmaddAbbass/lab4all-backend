// ── /schemas/experiments/ExpCreateSchema.ts ─────────────────────────
import { z } from "zod";

export const ExperimentCreateSchema = z.object({
  classId:     z.string().min(1),            // e.g. "hcdev-34343"
  prototypeId: z.string().min(1),            // "titration-x3458"
  title:       z.string().min(1).max(120),   // "Acid–Base Titration"
});

export type ExperimentCreateInput = z.infer<typeof ExperimentCreateSchema>;