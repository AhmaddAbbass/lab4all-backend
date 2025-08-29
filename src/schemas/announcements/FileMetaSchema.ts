import { z } from "zod";

export const FileMetaSchema = z.object({
  role: z.enum(["body", "attachment"]),
  filename: z.string().min(1, "filename required"),
  contentType: z.string().min(1, "contentType required"),
});
export type FileMeta = z.infer<typeof FileMetaSchema>;
