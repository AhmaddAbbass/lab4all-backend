import { z } from "zod";

export const AnnFetchSchema = z.object({
  classID: z.string(),
  k: z.number().min(1).max(50),
  cursor: z.string().optional(),
});

export type AnnFetchInput = z.infer<typeof AnnFetchSchema>;
