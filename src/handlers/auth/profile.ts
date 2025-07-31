import { APIGatewayProxyHandler } from 'aws-lambda';

export const profileHandler: APIGatewayProxyHandler = async (event) => {
  // extract Cognito claims from the authorizer
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // pick out the fields you care about
  console.log(claims.sub); 
  const userProfile = {
    userId: claims.sub,
    email:  claims.email,
    role:   claims['custom:role'],
    school: claims['custom:school'],
    grade:  claims['custom:grade'],
  };

  return {
    statusCode: 200,
    body: JSON.stringify(userProfile),
  };
};
