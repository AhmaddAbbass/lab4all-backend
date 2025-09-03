import { z } from "zod";
import {
  EnvironmentSchema,
  PropertiesSchema,
  ContentsSchema,
} from "./environment";

/** UI event hints the frontend can act on directly. */
export const UIEventSchema = z.object({
  path: z.string(),                // e.g., "properties.pH", "contents.solids"
  effect: z.string(),              // e.g., "updatePHMeter", "spawnGasBubbles"
  payload: z.unknown().optional(), // effect-specific data
});

/** Generic tool update (pHmeter reading, on/off, etc.). */
export const ToolUpdateSchema = z
  .object({
    reading: z.number().optional(),
    status: z.enum(["on", "off"]).optional(),
  })
  .catchall(z.unknown());

/** Environment diff: require 'id', everything else optional (minimal diff). */
export const EnvironmentDiffSchema = z.intersection(
  z.object({ id: z.string() }),
  z.object({
    type: z.string().optional(),
    properties: PropertiesSchema.optional(),
    contents: ContentsSchema.optional(),
    attachedTools: z.array(z.string()).optional(),
  })
);

export const PostActionSchema = z.object({
  environment: EnvironmentDiffSchema.optional(),
  tools: z.record(ToolUpdateSchema).optional(), // key = toolId
  uiEvents: z.array(UIEventSchema).optional(),
});

export type UIEvent = z.infer<typeof UIEventSchema>;
export type PostAction = z.infer<typeof PostActionSchema>;
