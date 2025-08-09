import { z } from 'zod';
export const SchoolSchema = z.object({
  schoolId:   z.string(),
  name:       z.string(),
  countryCode:z.string().length(2),
  city:       z.string(),
  nameSlug:   z.string(),
  citySlug:   z.string(),
  createdAt:  z.string().datetime(),
  createdBy:  z.string(),
});
export type School = z.infer<typeof SchoolSchema>;
