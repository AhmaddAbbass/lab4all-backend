import { dobClient } from "../dynamo";

/**
 * Toggle hidden flags for an experiment.
 * - Student: only toggles hiddenByOwner.
 * - Teacher (always the owner in this model): toggles both flags in sync.
 */
export async function toggleExperimentVisibility(
  classId: string,
  experimentId: string,
  role: "student" | "teacher"
) {
  const pk = `CLASS#${classId}`;
  const sk = experimentId;

  const result = await dobClient
    .get({
      TableName: process.env.EXPERIMENTS_TABLE!,
      Key: { PK: pk, SK: sk },
    })
    .promise();

  if (!result.Item) return null;

  let updates: string[] = [];
  let values: Record<string, any> = {};

  if (role === "teacher") {
    // Teacher is also the owner, so flip both in sync
    const newVal = !(result.Item.hiddenByTeacher || result.Item.hiddenByOwner);
    updates.push("hiddenByTeacher = :val", "hiddenByOwner = :val");
    values[":val"] = newVal;
  } else if (role === "student") {
    const newVal = !result.Item.hiddenByOwner;
    updates.push("hiddenByOwner = :owner");
    values[":owner"] = newVal;
  }

  if (updates.length === 0) return result.Item;

  await dobClient
    .update({
      TableName: process.env.EXPERIMENTS_TABLE!,
      Key: { PK: pk, SK: sk },
      UpdateExpression: "SET " + updates.join(", "),
      ExpressionAttributeValues: values,
    })
    .promise();

  return { ...result.Item, ...Object.fromEntries(
    Object.entries(values).map(([k,v]) => [k.replace(":", ""), v])
  ) };
}
