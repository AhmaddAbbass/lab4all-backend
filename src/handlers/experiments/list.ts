import { APIGatewayProxyHandler } from "aws-lambda";
import { queryExperiments } from "../../utils/database/experiments/queryExperiments";
import { DEFAULT_HEADERS } from "../../utils/headers/defaults";

/*
listExperimentsHandler

Handler for GET /experiments/list.  
Returns a paginated list of experiments for a given classroom.

Flow:
- Validate Cognito claims → must be authenticated.
- Parse query parameters:
  - classId (required)
  - k (limit, defaults to 10)
  - cursor (optional pagination token)
- Call queryExperiments util:
  - Queries DynamoDB by PK=CLASS#<classId>.
  - Applies visibility rules depending on userId and role.
  - Returns list of experiments and a nextCursor if more exist.
- Respond with JSON containing experiments[] and nextCursor.

Error codes:
- 400 → missing classId
- 401 → unauthorized (no claims)
- 500 → query/DynamoDB/internal error

Note: Membership validation is not enforced here yet;  
in production, verify caller is a member of the class before listing.
*/

export const listExperimentsHandler: APIGatewayProxyHandler = async (event) => {
  try {
    const claims = event.requestContext?.authorizer?.claims;
    if (!claims) {
      return {
        statusCode: 401,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const userId = `USER#${claims.sub}`;
    const { classId, k = "10", cursor } = event.queryStringParameters || {};

    if (!classId) {
      return {
        statusCode: 400,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: "Missing classId" }),
      };
    }

    const { experiments, nextCursor } = await queryExperiments({
      classId,
      userId,
      role: claims["custom:role"],
      limit: parseInt(k, 10),
      cursor: cursor || undefined,
    });

    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({
        experiments,
        nextCursor, // frontend passes this on next request
      }),
    };
  } catch (err) {
    console.error("List experiments error:", err);
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
