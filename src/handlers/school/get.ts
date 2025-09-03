// src/handlers/school/get.ts
import { APIGatewayProxyHandler } from "aws-lambda";
import { getSchoolById } from "../../utils/database/schools/getSchoolById";

/*
getSchoolHandler

Handler for GET /schools/{schoolId}.  
Fetches a school record by its ID.

Flow:
- Extract schoolId from path parameters.
- If missing → return 400.
- Call getSchoolById util to fetch school record from DynamoDB.
- If no record found → return 404.
- Otherwise → return school object.

Error codes:
- 400 → missing schoolId
- 404 → school not found
- 500 → internal server/database error
*/

export const getSchoolHandler: APIGatewayProxyHandler = async (event) => {
  const schoolId = event.pathParameters?.schoolId?.trim();
  if (!schoolId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "MISSING_SCHOOL_ID" }),
    };
  }

  try {
    const school = await getSchoolById(schoolId);
    if (!school) {
      return { statusCode: 404, body: JSON.stringify({ error: "NOT_FOUND" }) };
    }
    return { statusCode: 200, body: JSON.stringify(school) };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || "Internal server error" }),
    };
  }
};
