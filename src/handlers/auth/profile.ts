// src/handlers/auth/profile.ts
import { APIGatewayProxyHandler } from 'aws-lambda';

export const profileHandler: APIGatewayProxyHandler = async (event) => {
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const userProfile = {
    userId:     claims.sub,
    email:      claims.email,
    firstName:  claims['given_name'],
    lastName:   claims['family_name'],
    role:       claims['custom:role'],
    grade:      claims['custom:grade'],
    schoolId:   claims['custom:schoolId'] || null,
    schoolName: claims['custom:school']   || null,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(userProfile),
  };
};
