import { z } from "zod";
import { ValueUnitSchema } from "./valueUnit";

/** Visual/instant effects that are not persistent chemistry. */
export const InstantsSchema = z.object({
  gas: z
    .object({
      compound: z.string(),        // e.g. "CO2"
      volume: z.number().optional(), // arbitrary intensity scalar
      color: z.string().optional(),
    })
    .optional(),
  sound: z
    .object({
      name: z.string(),              // e.g., "fizz"
      intensity: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

/** Physical properties we render in the UI. */
export const PropertiesSchema = z.object({
  temperature: ValueUnitSchema.optional(), // e.g., { value: 25, unit: "°C" }
  pH: z.number().min(0).max(14).optional(),
  instants: InstantsSchema.optional(),
});

/** Liquids by name with volume + (optional) color */
export const LiquidSchema = z.object({
  volume: ValueUnitSchema,
  color: z.string().optional(),
});

/** Solids by name; mass optional (we sometimes only render color/exists) */
export const SolidSchema = z.object({
  mass: ValueUnitSchema.optional(),
  color: z.string().optional(),
});

/** Aqueous species (ions) with concentration (unit usually "M"). */
export const AqueousSpeciesSchema = z.object({
  concentration: ValueUnitSchema,
});

export const ContentsSchema = z.object({
  liquids: z.record(LiquidSchema).default({}),
  solids: z.record(SolidSchema).default({}),
  aqueous: z.record(AqueousSpeciesSchema).default({}),
});

/** One environment container (beaker, flask...). */
export const EnvironmentSchema = z.object({
  id: z.string(),
  type: z.string(), // e.g., "Beaker"
  properties: PropertiesSchema.default({}),
  contents: ContentsSchema.default({ liquids: {}, solids: {}, aqueous: {} }),
  attachedTools: z.array(z.string()).default([]), // tool IDs, e.g., ["pHmeter1"]
});

export type Environment = z.infer<typeof EnvironmentSchema>;
