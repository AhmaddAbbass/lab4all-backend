import { dobClient } from "../dynamo";
export async function deleteExperiment(classId: string, experimentId: string) {
  const pk = `CLASS#${classId}`;
  const sk = experimentId;

  await dobClient
    .delete({
      TableName: process.env.EXPERIMENTS_TABLE!,
      Key: { PK: pk, SK: sk },
    })
    .promise();
}
