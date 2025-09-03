import { z } from "zod";
import { ValueUnitSchema } from "./valueUnit";

/** Declared before the session starts. */
const SetupSolutionSchema = z.object({
  name: z.string(),                 // e.g., "HCl"
  molarity: ValueUnitSchema,        // { value: 0.1, unit: "M" }
});

const SetupMaterialsSchema = z.object({
  solutions: z.array(SetupSolutionSchema).default([]),
  solids: z.array(z.string()).default([]),   // e.g., ["CaCO3"]
  liquids: z.array(z.string()).default([]),  // e.g., ["Water"]
});

const SetupToolSchema = z.object({
  id: z.string(),                   // e.g., "pHmeter1"
  type: z.string(),                 // e.g., "pHmeter"
  target: z.string().optional(),    // initial attached environment id
});

const SetupEnvironmentSchema = z.object({
  id: z.string(),
  type: z.string(),                 // e.g., "Beaker"
  capacity: ValueUnitSchema.optional(), // { value: 1000, unit: "mL" }
});

export const SetupSchema = z.object({
  materials: SetupMaterialsSchema,
  tools: z.array(SetupToolSchema).default([]),
  environments: z.array(SetupEnvironmentSchema).default([]),
});

export type Setup = z.infer<typeof SetupSchema>;
