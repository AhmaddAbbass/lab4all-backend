// utils/database/experiments/completeExperiment.ts
import { dobClient } from '../dynamo';

export async function markExperimentFinished(classId: string, experimentId: string) {
  await dobClient
    .update({
      TableName: process.env.EXPERIMENTS_TABLE!,
      Key: { PK: `CLASS#${classId}`, SK: experimentId },
      UpdateExpression: 'SET pending = :f',
      ExpressionAttributeValues: { ':f': false },
    })
    .promise();
}