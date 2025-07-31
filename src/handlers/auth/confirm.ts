import { APIGatewayProxyHandler } from 'aws-lambda';
import AWS from 'aws-sdk';
import { z } from 'zod';

const cognito = new AWS.CognitoIdentityServiceProvider();

const bodySchema = z.object({
  email: z.string().email(),
  code:  z.string().length(6),
});

export const confirmHandler: APIGatewayProxyHandler = async (event) => {
  const parsed = bodySchema.safeParse(JSON.parse(event.body || '{}'));
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'INVALID_INPUT', details: parsed.error.format() }),
    };
  }

  const { email, code } = parsed.data;

  try {
    await cognito.confirmSignUp({
      ClientId: process.env.CLIENT_ID!,
      Username: email,
      ConfirmationCode: code,
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Account confirmed successfully' }),
    };
  } catch (err: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err.message || 'Confirmation failed' }),
    };
  }
};
