import { z } from "zod";
import { EnvironmentSchema } from "./environment";
import { ActionRecordSchema } from "./action";
import { SetupSchema } from "./setup";

export const TimelineFileSchema = z.object({
 setup:    SetupSchema,
  environments: z.record(EnvironmentSchema),
  history: z.array(ActionRecordSchema),
});
export type TimelineFile = z.infer<typeof TimelineFileSchema>;
