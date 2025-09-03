// src/handlers/school/register.ts
import { APIGatewayProxyHandler } from "aws-lambda";
import { z } from "zod";
import { putSchool } from "../../utils/database/schools/insertSchool";
import { toSlug } from "../../utils/other/toSlug";
import AWS from "aws-sdk";

const cognito = new AWS.CognitoIdentityServiceProvider();

/*
registerSchoolHandler

Handler for POST /school/register.  
Allows instructors to register a new school and optionally bind it to their Cognito account.

Flow:
- AuthN + role check → only instructors can call this endpoint.
- Parse body with zod schema: { name, countryCode (2 letters), city, schoolId? }.
- If schoolId not provided, derive from name slug.
- Compute additional fields for indexing/browse: nameSlug, citySlug, ccCity.
- Create school record in DynamoDB using putSchool (fail if ID exists).
- Attempt to auto-bind instructor’s Cognito user with custom:schoolId & custom:school.
  - If success → boundToUser=true, return note instructing re-login.
  - If failure → boundToUser=false, school is still created.

Returns:
- 201 → school created, includes { schoolId, name, countryCode, city, boundToUser, note }.
- 400 → invalid JSON or input
- 401 → unauthorized
- 403 → non-instructor attempt
- 409 → schoolId already exists
- 400 (generic) → other Dynamo/Cognito errors

Notes:
- Ensures canonical uppercase ISO countryCode.
- Auto-binding step is best-effort; school creation is independent.
*/

/**
 * POST /school/register
 * Instructor-only.
 * Body: { name: string, countryCode: string(2), city: string, schoolId?: string }
 * - If schoolId missing, derive from name (slug).
 * - Also compute nameSlug, citySlug, ccCity for indexing/browse.
 * - After creation, auto-bind instructor's Cognito user (custom:schoolId/custom:school).
 */
const bodySchema = z.object({
  name: z.string().min(1).trim(),
  countryCode: z.string().length(2).trim(),
  city: z.string().min(1).trim(),
  schoolId: z.string().trim().optional(),
});

export const registerSchoolHandler: APIGatewayProxyHandler = async (event) => {
  // AuthN & role gate
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }
  if (claims["custom:role"] !== "instructor") {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "INSTRUCTOR_ONLY" }),
    };
  }

  // Parse & validate body
  let body: unknown;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "INVALID_JSON" }) };
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "INVALID_INPUT",
        details: parsed.error.format(),
      }),
    };
  }

  const { name, countryCode, city, schoolId: providedId } = parsed.data;

  const finalSchoolId = (
    providedId && providedId.trim().length > 0 ? providedId : toSlug(name)
  ).toLowerCase();
  const nameSlug = toSlug(name);
  const citySlug = toSlug(city);
  const cc = countryCode.toUpperCase();
  const ccCity = `${cc}#${citySlug}`;

  const item = {
    schoolId: finalSchoolId,
    name,
    countryCode: cc,
    city,
    nameSlug,
    citySlug,
    ccCity,
    createdAt: new Date().toISOString(),
    createdBy: claims.sub,
  };

  try {
    // 1) Create school (no overwrite)
    await putSchool(item);

    // 2) Try to auto-bind the instructor's Cognito user
    let boundToUser = false;
    let bindNote: string | undefined;

    try {
      const userPoolId = process.env.USER_POOL_ID!;
      // Prefer Cognito username from claims; fallback to email or sub
      const username =
        (claims as any)["cognito:username"] ||
        (claims as any).username ||
        (claims as any).email ||
        (claims as any).sub;

      await cognito
        .adminUpdateUserAttributes({
          UserPoolId: userPoolId,
          Username: username,
          UserAttributes: [
            { Name: "custom:schoolId", Value: finalSchoolId },
            { Name: "custom:school", Value: name },
          ],
        })
        .promise();

      boundToUser = true;
      bindNote =
        "School registered and linked to your account. Please sign out and sign in again to refresh your token.";
    } catch (bindErr) {
      console.error("Failed to bind instructor to school:", bindErr);
      // School is created; user can still bind later or on next login flow
      boundToUser = false;
      bindNote =
        "School registered. We could not link it to your account automatically. You may need to re-login or bind later.";
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        schoolId: finalSchoolId,
        name,
        countryCode: cc,
        city,
        boundToUser,
        note: bindNote,
      }),
    };
  } catch (err: any) {
    const code = err?.code || err?.name;
    if (code === "ConditionalCheckFailedException") {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: "SCHOOL_ID_ALREADY_EXISTS" }),
      };
    }
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: err?.message || "Failed to register school",
      }),
    };
  }
};
