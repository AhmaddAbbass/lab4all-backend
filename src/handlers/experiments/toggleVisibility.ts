import { APIGatewayProxyHandler } from "aws-lambda";
import { getExperimentRecord } from "../../utils/database/experiments/getExperiment";
import { toggleExperimentVisibility } from "../../utils/database/experiments/toggleVisibility";
import { DEFAULT_HEADERS } from "../../utils/headers/defaults";

/*
toggleVisibilityExperimentHandler

Handler for POST /experiments/togglehide.  
Allows either the experiment owner (student) or an instructor to toggle the visibility state of an experiment.

Flow:
- Validate Cognito claims → must be authenticated.
- Parse body → requires classId and experimentId.
- Fetch experiment record from DynamoDB:
  - Return 404 if not found.
- Determine authorization:
  - Owner may toggle their own experiment.
  - Instructor may toggle any experiment in their class.
  - Otherwise → 403 Forbidden.
- Pass computed role ("student" or "teacher") to toggleExperimentVisibility.
- Return success response.

Error codes:
- 400 → invalid JSON or missing fields
- 401 → unauthorized (no claims)
- 403 → forbidden (not owner or instructor)
- 404 → experiment not found
- 500 → internal server error

*/

export const toggleVisibilityExperimentHandler: APIGatewayProxyHandler = async (
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

    // 4. Determine role
    const isOwner = record.userId === `USER#${userId}`;
    const isTeacher = claims["custom:role"] === "instructor";

    if (!isOwner && !isTeacher) {
      return {
        statusCode: 403,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    const role: "student" | "teacher" = isTeacher ? "teacher" : "student";

    // 5. Toggle visibility
    const updated = await toggleExperimentVisibility(
      classId,
      experimentId,
      role
    );

    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("Toggle experiment visibility error:", err);
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
