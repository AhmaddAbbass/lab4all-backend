import { z } from "zod";
import { EnvironmentSchema } from "./environment";
import { ActionSchema, ActionRecordSchema } from "./action";
import { PostActionSchema, UIEventSchema } from "./postAction";


export const FreeStepRequestSchema = z.object({
  classroomId: z.string(),
  env: EnvironmentSchema,
  action: ActionSchema,
  history: z.array(ActionRecordSchema),
});

export type FreeStepRequest = z.infer<typeof FreeStepRequestSchema>;


export const FreeStepResponseSchema = z.object({
  postAction: PostActionSchema,
  uiEvents: z.array(UIEventSchema),
  tokensIn:  z.number().optional(),
  tokensOut: z.number().optional(),
});

export type FreeStepResponse = z.infer<typeof FreeStepResponseSchema>;
