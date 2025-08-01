// models/membership.ts
import { z } from 'zod';

export const MembershipSchema = z.object({
  PK: z.string(),
  SK: z.string(),
  role: z.enum(['student', 'instructor']),
  joinedAt: z.string().datetime() // ISO 8601 format
});

export type Membership = z.infer<typeof MembershipSchema>;
