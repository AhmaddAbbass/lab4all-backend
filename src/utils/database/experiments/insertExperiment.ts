// utils/database/experiments/insertExperiment.ts
// SDK v2 – uses the shared DocumentClient from lib/dynamo.ts

import { dobClient } from "../dynamo"; // adjust relative path
import { ExperimentItem } from "../../../schemas/experiments/ExpItem";

const TABLE_NAME = process.env.EXPERIMENTS_TABLE!;
const PENDING_LIMIT = 3;

/**
 * Inserts a new experiment item.
 * Throws if the caller already has ≥ 3 pending experiments
 *     or if a conflicting PK/SK already exists.
 */
export async function insertExperimentRecord(
  item: ExperimentItem
): Promise<void> {
  /* 1. enforce “≤ 3 pending” */
  const pendingCount = await dobClient
    .query({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :uid",
      FilterExpression: "pending = :p",
      ExpressionAttributeValues: {
        ":uid": item.userId, // "USER#<sub>"
        ":p": true,
      },
      Select: "COUNT",
    })
    .promise();

  if ((pendingCount.Count ?? 0) >= PENDING_LIMIT) {
    throw new Error("Pending experiment limit reached");
  }

  /* 2. conditional put (no overwrite) */
  await dobClient
    .put({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression:
        "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    })
    .promise();
}
