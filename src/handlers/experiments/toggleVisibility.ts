import { APIGatewayProxyHandler } from "aws-lambda";
import { getExperimentRecord } from "../../utils/database/experiments/getExperiment";
import { toggleExperimentVisibility } from "../../utils/database/experiments/toggleVisibility";

export const toggleVisibilityExperimentHandler: APIGatewayProxyHandler = async (
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
    const userId = claims.sub;

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

    // 4. Determine role
    const isOwner = record.userId === `USER#${userId}`;
    const isTeacher = claims["custom:role"] === "instructor";

    if (!isOwner && !isTeacher) {
      return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
    }

    const role: "student" | "teacher" = isTeacher ? "teacher" : "student";

    // 5. Toggle visibility
    const updated = await toggleExperimentVisibility(
      classId,
      experimentId,
      "student"
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("Toggle experiment visibility error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
