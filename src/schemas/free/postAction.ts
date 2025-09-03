import { z } from "zod";
import { EnvironmentSchema, ToolSchema } from "./environment";

// helper: partial env but id required
const PartialEnvironmentSchema = EnvironmentSchema.partial().extend({
  id: z.string(), // still required
});

export const UIEventSchema = z.object({
  path: z.string(), // e.g. "properties.instants.gas"
  effect: z.string(), // "spawnGasBubbles"
  payload: z.unknown().optional(), // free-form for FE
});
export type UIEvent = z.infer<typeof UIEventSchema>;

export const PostActionSchema = z.object({
  environment: PartialEnvironmentSchema.optional(),
  tools: z.record(ToolSchema.partial()).optional(),
  uiEvents: z.array(UIEventSchema).optional(),
});
export type PostAction = z.infer<typeof PostActionSchema>;
