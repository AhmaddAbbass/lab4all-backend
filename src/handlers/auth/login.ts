// src/handlers/auth/login.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import AWS from 'aws-sdk';
import { z } from 'zod';

const cognito = new AWS.CognitoIdentityServiceProvider();

const bodySchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
});

// tiny base64url decoder (no external deps)
function decodeJwtPayload<T = any>(jwt: string): T | null {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export const loginHandler: APIGatewayProxyHandler = async (event) => {
  // parse + validate
  let body: unknown;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'INVALID_JSON' }) };
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'INVALID_INPUT', details: parsed.error.format() }),
    };
  }

  const emailNorm = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;

  try {
    const res = await cognito.initiateAuth({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.CLIENT_ID!,
      AuthParameters: {
        USERNAME: emailNorm,
        PASSWORD: password,
      },
    }).promise();

    const auth = res.AuthenticationResult || {};
    const idToken = auth.IdToken as string | undefined;

    // Optional hint: if instructor has no schoolId, nudge them to register a school
    let needsSchoolRegistration = false;
    let note: string | undefined;
    if (idToken) {
      const payload = decodeJwtPayload<Record<string, any>>(idToken);
      const role = payload?.['custom:role'];
      const schoolId = payload?.['custom:schoolId'];
      if (role === 'instructor' && !schoolId) {
        needsSchoolRegistration = true;
        note = 'Welcome! Please register your school so students can join.';
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ...auth,
        ...(needsSchoolRegistration ? { needsSchoolRegistration: true, note } : {}),
      }),
    };
  } catch (err: any) {
    const code = err?.code || err?.name;

    // Map common Cognito errors
    if (code === 'NotAuthorizedException') {
      return { statusCode: 401, body: JSON.stringify({ error: 'INVALID_CREDENTIALS' }) };
    }
    if (code === 'UserNotConfirmedException') {
      return { statusCode: 403, body: JSON.stringify({ error: 'USER_NOT_CONFIRMED' }) };
    }
    if (code === 'PasswordResetRequiredException') {
      return { statusCode: 403, body: JSON.stringify({ error: 'PASSWORD_RESET_REQUIRED' }) };
    }
    if (code === 'UserNotFoundException') {
      return { statusCode: 404, body: JSON.stringify({ error: 'USER_NOT_FOUND' }) };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: err?.message || 'Login failed' }),
    };
  }
};
