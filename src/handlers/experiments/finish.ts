// handlers/experiments/finish.ts
// After you upload you check it worked with this route, if it didnt you say it failed or try again 
import { APIGatewayProxyHandler } from "aws-lambda";
import { getExperimentRecord } from "../../utils/database/experiments/getExperiment";
import { markExperimentFinished } from "../../utils/database/experiments/completeExperiment";
import AWS from "aws-sdk";

const s3 = new AWS.S3();

export const finishExperimentHandler: APIGatewayProxyHandler = async (event) => {
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const userId = claims.sub;
  if (!event.body) return { statusCode: 400, body: "Missing body" };

  const { classId, experimentId } = JSON.parse(event.body);
  const record = await getExperimentRecord(classId, experimentId);
  if (!record) return { statusCode: 404, body: "Experiment not found" };

  if (record.userId !== `USER#${userId}`) {
    return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
  }

  // Optional safety: check file exists
  try {
    await s3.headObject({
      Bucket: process.env.EXPERIMENTS_BUCKET!,
      Key: record.s3Key,
    }).promise();
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "File not uploaded" }) };
  }

  // Mark finished in DB
  await markExperimentFinished(classId, experimentId);

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
