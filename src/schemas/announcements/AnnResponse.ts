import { z } from "zod";

export const AnnouncementResponse = z.object({
  announcementId: z.string(),
  createdAt: z.string(),
  kind: z.string(),
  authorId: z.string(),
  pinned: z.boolean(),
  files: z.array(
    z.object({
      role: z.enum(["body", "attachment"]),
      filename: z.string(),
      url: z.string(),
      expiresAt: z.string()
    })
  )
});

export type AnnouncementResponse = z.infer<typeof AnnouncementResponse>;

// For the fetch endpoint → return array
export const AnnouncementFetchResponse = z.array(AnnouncementResponse);
export type AnnouncementFetchResponse = z.infer<typeof AnnouncementFetchResponse>;
