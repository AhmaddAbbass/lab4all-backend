import { z } from "zod";

export const AnnouncementFetchQuery = z.object({
  classId: z.string().min(1, "classId is required"),
  k: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 1)) // default 1
    .pipe(z.number().min(1).max(50))                 // keep k small
});

export type AnnouncementFetchQuery = z.infer<typeof AnnouncementFetchQuery>;
