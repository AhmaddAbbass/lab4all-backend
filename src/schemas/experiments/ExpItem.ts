// /schemas/experiments/ExpItem.ts
import { z } from 'zod';

export const ExperimentItemSchema = z.object({
  /* table keys */
  PK: z.string(),                        // "CLASS#<classId>"
  SK: z.string(),                        // "EXP#<ISO>#<uuid>"

  /* ownership & lookup */
  classId:      z.string(),
  experimentId: z.string(),              // same as SK
  userId:       z.string(),              // "USER#<sub>"
  ownerRole:    z.string(),              // "ROLE#<role>"
  /* content */
  prototypeId:  z.string(),
  title:        z.string(),
  createdAt:    z.string(),              // ISO-8601

  /* states */
  pending:          z.boolean(),
  hiddenByTeacher:  z.boolean(),
  hiddenByOwner:    z.boolean(),

  /* storage */
  s3Key: z.string(),

  /* single GSI: “my experiments” */
  GSI1PK: z.string(),                    // = userId
  GSI1SK: z.string(),                    // reuse SK (no extra createdAt)
});

export type ExperimentItem = z.infer<typeof ExperimentItemSchema>;
