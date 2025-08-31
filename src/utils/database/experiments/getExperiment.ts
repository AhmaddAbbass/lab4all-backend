// utils/database/experiments/getExperiment.ts
import { dobClient } from "../dynamo";

const TABLE = process.env.EXPERIMENTS_TABLE!;

export async function getExperimentRecord(
  classId: string,
  experimentId: string
) {
  const res = await dobClient
    .get({
      TableName: TABLE,
      Key: { PK: `CLASS#${classId}`, SK: experimentId },
    })
    .promise();
  console.log("Query result:", res);

  return res.Item ?? null;
}
