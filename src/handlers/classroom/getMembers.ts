import { APIGatewayProxyHandler } from 'aws-lambda';

export const getMembersHandler: APIGatewayProxyHandler = async (event) => {
  
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }
  const userProfile = {
    userId: claims.sub,
    email:  claims.email,
    role:   claims['custom:role'],
    school: claims['custom:school'],
    grade:  claims['custom:grade'],
  };
  // Here you would typically handle retrieval of classroom members

  return {
    statusCode: 200,
    body: "Your get members route is working",
  };
};
