import { APIGatewayProxyHandler } from "aws-lambda";
import { getExperimentRecord } from "../../utils/database/experiments/getExperiment";
import { presignGetUrlExp } from "../../utils/s3/s3experiments";

export const getExperimentInfoHandler: APIGatewayProxyHandler = async (
  event
) => {
  try {
    // 1. Auth
    const claims = (event.requestContext.authorizer as any)?.claims;
    if (!claims) {
      return {
        statusCode: 401,
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
        body: JSON.stringify({ error: "Invalid JSON body" }),
      };
    }

    const { classId, experimentId } = input;
    if (!classId || !experimentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing classId or experimentId" }),
      };
    }

    // 3. Fetch record
    const record = await getExperimentRecord(classId, experimentId);
    if (!record) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Experiment not found" }),
      };
    }

    // 4. Generate presigned URL to linfo.txt
    const url = presignGetUrlExp(record.s3Key);

    return {
      statusCode: 200,
      body: JSON.stringify({ url }),
    };
  } catch (err) {
    console.error("Get experiment info error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
