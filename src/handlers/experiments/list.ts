import { APIGatewayProxyHandler } from "aws-lambda";
import { queryExperiments } from "../../utils/database/experiments/queryExperiments";
import { DEFAULT_HEADERS } from "../../utils/headers/defaults";

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
