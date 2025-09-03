// auth/confirm.ts
import { APIGatewayProxyHandler } from "aws-lambda";
import AWS from "aws-sdk";
import { z } from "zod";

/*
confirmHandler

Handler for POST /auth/confirm.
Confirms a user’s Cognito account using the emailed 6-digit code.

Flow:
- Parse and validate body with zod (email, 6-digit code).
- Call AWS Cognito `confirmSignUp` with ClientId, Username, and ConfirmationCode.
- On success → return 200 with confirmation message.
- On failure → return 400 with error details.

Error codes:
- 400 → invalid input or Cognito confirmation error
*/

const cognito = new AWS.CognitoIdentityServiceProvider();

const bodySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const confirmHandler: APIGatewayProxyHandler = async (event) => {
  const parsed = bodySchema.safeParse(JSON.parse(event.body || "{}"));
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "INVALID_INPUT",
        details: parsed.error.format(),
      }),
    };
  }

  const { email, code } = parsed.data;

  try {
    await cognito
      .confirmSignUp({
        ClientId: process.env.CLIENT_ID!,
        Username: email,
        ConfirmationCode: code,
      })
      .promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Account confirmed successfully" }),
    };
  } catch (err: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err.message || "Confirmation failed" }),
    };
  }
};
