import { APIGatewayProxyHandler } from "aws-lambda";
import {
  ExperimentLogInputSchema,
  ExperimentLogInput,
} from "../../schemas/experiments/ExpLogInputSchema";
import { getExperimentRecord } from "../../utils/database/experiments/getExperiment";
import { markExperimentFinished } from "../../utils/database/experiments/completeExperiment";
import { presignPutUrlExp } from "../../utils/s3/s3experiments";

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
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }
  const userId = claims.sub;
  // 2. Check for request body
  if (!event.body) return { statusCode: 400, body: "Missing body" };

  // 3. Input validation
  let parsed: ExperimentLogInput;
  try {
    parsed = ExperimentLogInputSchema.parse(JSON.parse(event.body));
  } catch (err: any) {
    return { statusCode: 400, body: JSON.stringify({ error: err.errors }) };
  }

  //4. fetch record

  const record = await getExperimentRecord(parsed.classId, parsed.experimentId);
  if (!record) return { statusCode: 404, body: "Experiment not found" };
  // 5. ownership check
  if (record.userId !== `USER#${claims.sub}`) {
    return { statusCode: 403, body: "Forbidden" }; // only the creator may log
  }
  // We will not mark the experiment finished unless the frontend tells us the info what uploading succesddfully. 
  // 6.. generate log-file key + presigned PUT URL
  const logKey = record.s3Key;
  const uploadUrl = await presignPutUrlExp(logKey, "text/plain"); // util already exists

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "After you upload, call experiments/finish",
      uploadUrl,
      key: logKey,
    }),
  };
};
