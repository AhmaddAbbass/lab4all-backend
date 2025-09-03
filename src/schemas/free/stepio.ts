import { z } from "zod";
import { EnvironmentSchema } from "./environment";
import { ActionSchema } from "./action";
import { PostActionSchema, UIEventSchema } from "./postAction";

/** One history item (what student did + what UI changed). */
export const ActionRecordSchema = z.object({
  action: ActionSchema,
  result: PostActionSchema,
  timestamp: z.string(), // ISO
});

/** Request payload FE sends to /free/step */
export const FreeStepRequestSchema = z.object({
  classroomId: z.string(),
  env: EnvironmentSchema,                    // snapshot BEFORE the new action
  action: ActionSchema,                      // the new action
  history: z.array(ActionRecordSchema).default([]), // previous steps
});

/** Response payload BE returns from /free/step */
export const FreeStepResponseSchema = z.object({
  postAction: PostActionSchema,              // minimal diff
  uiEvents: z.array(UIEventSchema),          // explicit UI hints
  tokensIn: z.number().nonnegative(),
  tokensOut: z.number().nonnegative(),
  quotaExceeded: z.boolean().optional(),     // advisory flag
});

export type ActionRecord = z.infer<typeof ActionRecordSchema>;
export type FreeStepRequest = z.infer<typeof FreeStepRequestSchema>;
export type FreeStepResponse = z.infer<typeof FreeStepResponseSchema>;
