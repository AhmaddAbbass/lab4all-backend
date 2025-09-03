import { z } from "zod";
import { SetupSchema } from "./setup";
import { EnvironmentSchema } from "./environment";
import { ActionSchema } from "./action";
import { PostActionSchema } from "./postAction";

/** Minimal embedded copy for timeline history. */
export const TimelineActionRecordSchema = z.object({
  action: ActionSchema,
  result: PostActionSchema,
  timestamp: z.string(), // ISO
});

/** The JSON you’ll save to S3 at session end (info.txt / timeline.json). */
export const TimelineFileSchema = z.object({
  setup: SetupSchema,                              // <-- was unknown(), now typed
  environments: z.record(EnvironmentSchema),       // id → Environment snapshot
  history: z.array(TimelineActionRecordSchema),    // full ordered history
});

export type TimelineFile = z.infer<typeof TimelineFileSchema>;
