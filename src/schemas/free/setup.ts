import { z } from "zod";
import { ValueUnitSchema } from "./valueUnit";


export const MaterialSpecSchema = z.object({
  name: z.string(),

  state: z.enum(["liquid", "solid", "gas"]),

  concentration: ValueUnitSchema.optional(),
  unlimited: z.boolean().default(false),
});
export type MaterialSpec = z.infer<typeof MaterialSpecSchema>;

export const ToolSpecSchema = z.object({
  id: z.string(),

  type: z.string(),
});
export type ToolSpec = z.infer<typeof ToolSpecSchema>;

export const EnvironmentSpecSchema = z.object({
  id: z.string(),

  type: z.string(),

  capacity: ValueUnitSchema.optional(),
});
export type EnvironmentSpec = z.infer<typeof EnvironmentSpecSchema>;


export const SetupSchema = z.object({

  materials: z.array(MaterialSpecSchema).nonempty(),

  tools: z.array(ToolSpecSchema).optional(),


  environments: z.array(EnvironmentSpecSchema).nonempty(),
});
export type Setup = z.infer<typeof SetupSchema>;
