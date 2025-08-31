import { dobClient } from "../dynamo";
interface QueryExperimentsParams {
  classId: string;
  userId: string; // e.g. USER#abc123
  role: "student" | "instructor";
  limit: number;
  cursor?: string;
}

/**
 * Paginated query for experiments of a class:
 * - includes user’s own experiments
 * - includes other experiments that are not hidden
 */
export async function queryExperiments({
  classId,
  userId,
  role,
  limit,
  cursor,
}: QueryExperimentsParams) {
  const pk = `CLASS#${classId}`;
  const params: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: process.env.EXPERIMENTS_TABLE!,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": pk },
    ScanIndexForward: false,
    Limit: limit,
  };

  if (cursor) {
    params.ExclusiveStartKey = JSON.parse(
      Buffer.from(cursor, "base64").toString("utf-8")
    );
  }

  let experiments: any[] = [];

  while (experiments.length < limit) {
    const result = await dobClient.query(params).promise();

const filtered = (result.Items || []).filter((exp) => {
  const isMine = exp.userId === userId;

  if (role === "instructor") {
    // Teacher sees only their own experiments
    return isMine;
  }

  if (role === "student") {
    const isTeacherExp = exp.ownerRole === "instructor";
    const notHidden = !(exp.hiddenByTeacher || exp.hiddenByOwner);
    return isMine || (isTeacherExp && notHidden);
  }

  return false;
});


    experiments.push(...filtered);

    if (!result.LastEvaluatedKey) {
      params.ExclusiveStartKey = undefined;
      break; // no more items
    }
    params.ExclusiveStartKey = result.LastEvaluatedKey;
  }
  experiments = experiments.slice(0, limit);
  const nextCursor = params.ExclusiveStartKey
    ? Buffer.from(JSON.stringify(params.ExclusiveStartKey)).toString("base64")
    : null;

  return { experiments, nextCursor };
}
