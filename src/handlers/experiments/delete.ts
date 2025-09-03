import { APIGatewayProxyHandler } from "aws-lambda";
import { getExperimentRecord } from "../../utils/database/experiments/getExperiment";
import { deleteExperiment } from "../../utils/database/experiments/deleteExperiment";
import { deleteExperimentFile } from "../../utils/s3/s3experiments";
import { DEFAULT_HEADERS } from "../../utils/headers/defaults";
/*
deleteExperimentHandler

Handler for DELETE /experiments/delete.
Deletes an experiment record and its associated file from S3.  
Only the owner (creator) of the experiment may perform this action.

Flow:
- Validate Cognito claims → must be authenticated user.
- Parse and validate request body → requires classId and experimentId.
- Fetch experiment record from DynamoDB:
  - Return 404 if not found.
  - Return 403 if caller is not the owner.
- Delete experiment file from S3 using record.s3Key.
- Delete experiment record from DynamoDB.
- Return success response.

Error codes:
- 400 → invalid JSON or missing fields
- 401 → unauthorized (no claims)
- 403 → user not owner of experiment
- 404 → experiment not found
- 500 → S3 or DynamoDB error
*/

export const deleteExperimentHandler: APIGatewayProxyHandler = async (
  event
) => {
  try {
    // 1. Auth
    const claims = (event.requestContext.authorizer as any)?.claims;
    if (!claims) {
      return {
        statusCode: 401,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }
    const userId = claims.sub;

    // 2. Params
    let input: any;
    try {
      input = event.body ? JSON.parse(event.body) : {};
    } catch {
      return {
        statusCode: 400,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: "Invalid JSON body" }),
      };
    }

    const { classId, experimentId } = input;
    if (!classId || !experimentId) {
      return {
        statusCode: 400,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: "Missing classId or experimentId" }),
      };
    }

    // 3. Fetch record
    const record = await getExperimentRecord(classId, experimentId);
    if (!record) {
      return {
        statusCode: 404,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: "Experiment not found" }),
      };
    }

    if (record.userId !== `USER#${userId}`) {
      return {
        statusCode: 403,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    // 4. Delete S3 file
    await deleteExperimentFile(process.env.EXPERIMENTS_BUCKET!, record.s3Key);

    // 5. Delete DB record
    await deleteExperiment(classId, experimentId);

    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ success: true, message: "Experiment deleted" }),
    };
  } catch (err) {
    console.error("Delete experiment error:", err);
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
