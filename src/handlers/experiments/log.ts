import { APIGatewayProxyHandler } from "aws-lambda";
import {
  ExperimentLogInputSchema,
  ExperimentLogInput,
} from "../../schemas/experiments/ExpLogInputSchema";
import { getExperimentRecord } from "../../utils/database/experiments/getExperiment";
import { markExperimentFinished } from "../../utils/database/experiments/completeExperiment";
import { presignPutUrlExp } from "../../utils/s3/s3experiments";
import { DEFAULT_HEADERS } from "../../utils/headers/defaults";
/*
logExperimentHandler

Handler for POST /experiments/log.  
Generates a presigned PUT URL so the experiment owner can upload their experiment log/info file to S3.

Flow:
- Validate Cognito claims → must be authenticated user.
- Parse and validate request body with ExperimentLogInputSchema (classId, experimentId).
- Fetch experiment record from DynamoDB:
  - Return 404 if not found.
  - Return 403 if caller is not the experiment owner.
- Use existing s3Key from record as the log file path.
- Generate presigned PUT URL for that key (content-type "text/plain").
- Return uploadUrl and key, with instruction to call /experiments/finish afterwards.

Error codes:
- 400 → missing/invalid body
- 401 → unauthorized (no claims)
- 403 → forbidden (not experiment owner)
- 404 → experiment not found
- 500 → internal server error (e.g., S3 signing issues)
*/

interface Body {
  classId: string; // "hcdev-34343"
  experimentId: string; // "EXP#2025-08-30T…#uuid"
}

export const logExperimentHandler: APIGatewayProxyHandler = async (event) => {
  //1. JWT claims
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return {
      statusCode: 401,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }
  const userId = claims.sub;
  // 2. Check for request body
  if (!event.body)
    return { statusCode: 400, headers: DEFAULT_HEADERS, body: "Missing body" };

  // 3. Input validation
  let parsed: ExperimentLogInput;
  try {
    parsed = ExperimentLogInputSchema.parse(JSON.parse(event.body));
  } catch (err: any) {
    return {
      statusCode: 400,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: err.errors }),
    };
  }

  //4. fetch record

  const record = await getExperimentRecord(parsed.classId, parsed.experimentId);
  if (!record)
    return {
      statusCode: 404,
      headers: DEFAULT_HEADERS,
      body: "Experiment not found",
    };
  // 5. ownership check
  if (record.userId !== `USER#${claims.sub}`) {
    return { statusCode: 403, headers: DEFAULT_HEADERS, body: "Forbidden" }; // only the creator may log
  }
  // We will not mark the experiment finished unless the frontend tells us the info what uploading succesddfully.
  // 6.. generate log-file key + presigned PUT URL
  const logKey = record.s3Key;
  const uploadUrl = await presignPutUrlExp(logKey, "text/plain"); // util already exists

  return {
    statusCode: 200,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      message: "After you upload, call experiments/finish",
      uploadUrl,
      key: logKey,
    }),
  };
};
