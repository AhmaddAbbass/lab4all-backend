import { APIGatewayProxyHandler } from "aws-lambda";
import { getExperimentRecord } from "../../utils/database/experiments/getExperiment";
import { presignGetUrlExp } from "../../utils/s3/s3experiments";
import { DEFAULT_HEADERS } from "../../utils/headers/defaults";

/*
getExperimentInfoHandler

Handler for POST /experiments/info.  
Returns a presigned GET URL for the experiment’s uploaded info.txt file.

Flow:
- Validate Cognito claims → must be authenticated user.
- Parse and validate request body → requires classId and experimentId.
- Fetch experiment record from DynamoDB:
  - Return 404 if not found.
- Generate a presigned GET URL for the file stored in S3 (record.s3Key).
- Return the URL to the client.

Error codes:
- 400 → invalid JSON body or missing fields
- 401 → unauthorized (no claims)
- 404 → experiment not found
- 500 → S3/DynamoDB/internal error

Note: Currently any authenticated user with classId + experimentId can fetch the URL;  
in production, enforce membership and ownership/instructor checks.
*/

export const getExperimentInfoHandler: APIGatewayProxyHandler = async (
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

    // 4. Generate presigned URL to linfo.txt
    const url = presignGetUrlExp(record.s3Key);

    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ url }),
    };
  } catch (err) {
    console.error("Get experiment info error:", err);
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
