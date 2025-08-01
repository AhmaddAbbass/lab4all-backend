// models/classroom.ts
import { z } from 'zod';

export const ClassroomSchema = z.object({
  classroomID: z.string(),
  classroomName: z.string(),
  school: z.string(),
  createdAt: z.string().datetime(), // ISO 8601 format
  teacherId: z.string(),
  teacherName: z.string(),
  joinCode: z.string() 
});
export type Classroom = z.infer<typeof ClassroomSchema>;


