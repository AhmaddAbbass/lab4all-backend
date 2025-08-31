// /schemas/experiments/ExpLogInputSchema.ts
import { z } from 'zod';

export const ExperimentLogInputSchema = z.object({
  classId:      z.string().min(1),
  experimentId: z.string().min(1),
});

export type ExperimentLogInput = z.infer<typeof ExperimentLogInputSchema>;
