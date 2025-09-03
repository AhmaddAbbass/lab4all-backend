// handlers/experiments/finish.ts
// After you upload you check it worked with this route, if it didnt you say it failed or try again
import { APIGatewayProxyHandler } from "aws-lambda";
import { getExperimentRecord } from "../../utils/database/experiments/getExperiment";
import { markExperimentFinished } from "../../utils/database/experiments/completeExperiment";
import AWS from "aws-sdk";
import { DEFAULT_HEADERS } from "../../utils/headers/defaults";
/*
finishExperimentHandler

Handler for POST /experiments/finish.  
Finalizes an experiment upload after the client has PUT the info file to S3.

Flow:
- Validate Cognito claims → must be the experiment owner.
- Parse request body → requires classId and experimentId.
- Fetch experiment record from DynamoDB:
  - Return 404 if not found.
  - Return 403 if caller is not the owner.
- Perform a safety check against S3:
  - headObject ensures the file at record.s3Key exists.
  - If not found → return 400 "File not uploaded".
- Mark experiment as finished in DynamoDB (pending=false).
- Return success response.

Error codes:
- 400 → missing body, invalid JSON, or file not uploaded
- 401 → unauthorized (no claims)
- 403 → forbidden (not experiment owner)
- 404 → experiment not found
- 500 → internal error from S3/Dynamo
*/

const s3 = new AWS.S3();

export const finishExperimentHandler: APIGatewayProxyHandler = async (
  event
) => {
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims)
    return {
      statusCode: 401,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "Unauthorized" }),
    };

  const userId = claims.sub;
  if (!event.body)
    return { statusCode: 400, headers: DEFAULT_HEADERS, body: "Missing body" };

  const { classId, experimentId } = JSON.parse(event.body);
  const record = await getExperimentRecord(classId, experimentId);
  if (!record)
    return {
      statusCode: 404,
      headers: DEFAULT_HEADERS,
      body: "Experiment not found",
    };

  if (record.userId !== `USER#${userId}`) {
    return {
      statusCode: 403,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "Forbidden" }),
    };
  }

  try {
    await s3
      .headObject({
        Bucket: process.env.EXPERIMENTS_BUCKET!,
        Key: record.s3Key,
      })
      .promise();
  } catch {
    return {
      statusCode: 400,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "File not uploaded" }),
    };
  }

  // Mark finished in DB
  await markExperimentFinished(classId, experimentId);

  return {
    statusCode: 200,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ success: true }),
  };
};
