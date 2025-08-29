// Defines how the body of announcement/create should look like 
import { z } from "zod";
import { FileMetaSchema } from "./FileMetaSchema";
export const AnnouncementCreateSchema = z.object({
  classroomId: z.string().min(1, "classroomId is required"),
  teacherId: z.string().min(1, "teacherId is required"),
  filesMeta: z.array(FileMetaSchema)
    .min(1, "At least one file required")
    .refine(
      arr => arr.filter(f => f.role === "body").length === 1,
      { message: "Exactly one file must have role=body" }
    )
});
export type AnnouncementCreateInput = z.infer<typeof AnnouncementCreateSchema>;

// Example of how the body should look like 
// {
//   "classroomId": "cls_123",
//   "teacherId": "usr_456",
//   "filesMeta": [
//     {
//       "role": "body",
//       "filename": "announcement.md",
//       "contentType": "text/markdown"
//     },
//     {
//       "role": "attachment",
//       "filename": "lab-guide.pdf",
//       "contentType": "application/pdf"
//     }
//   ]
// }
