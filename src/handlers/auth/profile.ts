// src/handlers/auth/profile.ts
import { APIGatewayProxyHandler } from "aws-lambda";
/*
profileHandler

Handler for GET /auth/profile.
Returns a snapshot of the authenticated user’s profile claims from Cognito.

Flow:
- Read JWT claims from API Gateway authorizer context.
- If missing → return 401 Unauthorized.
- Map claims into a user profile object:
  - userId, email, firstName, lastName
  - role, grade, schoolId, schoolName
- Return 200 with profile JSON.

Error codes:
- 401 → unauthorized (no claims found)
*/

export const profileHandler: APIGatewayProxyHandler = async (event) => {
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const userProfile = {
    userId: claims.sub,
    email: claims.email,
    firstName: claims["given_name"],
    lastName: claims["family_name"],
    role: claims["custom:role"],
    grade: claims["custom:grade"],
    schoolId: claims["custom:schoolId"] || null,
    schoolName: claims["custom:school"] || null,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(userProfile),
  };
};
