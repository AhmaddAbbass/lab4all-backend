import { APIGatewayProxyHandler } from 'aws-lambda';
import AWS from 'aws-sdk';
import { z } from 'zod';

const cognito = new AWS.CognitoIdentityServiceProvider();

const bodySchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
});

export const loginHandler: APIGatewayProxyHandler = async (event) => {
  const parsed = bodySchema.safeParse(JSON.parse(event.body || '{}'));
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'INVALID_INPUT',
        details: parsed.error.format(),
      }),
    };
  }

  const { email, password } = parsed.data;

  try {
    // call Cognito to authenticate the user
    const authResult = await cognito
      .initiateAuth({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.CLIENT_ID!,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      })
      .promise();

    // return tokens
    return {
      statusCode: 200,
      body: JSON.stringify(authResult.AuthenticationResult || {}),
    };
  } catch (err: any) {

    return {
      statusCode: err.code === 'NotAuthorizedException' ? 401 : 400,
      body: JSON.stringify({
        error: err.message || 'Login failed',
      }),
    };
  }
};
