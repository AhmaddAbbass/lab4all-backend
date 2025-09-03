import { z } from "zod";
import { ValueUnitSchema } from "./valueUnit";
import { PostActionSchema } from "./postAction";

export const ActionSchema = z.object({
  type: z.string(), // "add" | "heat" | …
  material: z.string().optional(),
  amount: ValueUnitSchema.optional(),
  target: z.string(), // envId
  note: z.string().optional(),
});
export type Action = z.infer<typeof ActionSchema>;

export const ActionRecordSchema = z.object({
  action: ActionSchema,
  result: PostActionSchema, // what LLM returned
  timestamp: z.string(), // ISO
});
export type ActionRecord = z.infer<typeof ActionRecordSchema>;
