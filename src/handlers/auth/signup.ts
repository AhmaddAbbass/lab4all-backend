// src/handlers/auth/signup.ts
import { APIGatewayProxyHandler } from "aws-lambda";
import AWS from "aws-sdk";
import { z } from "zod";
import { resolveSchool } from "../../utils/database/schools/fetchSchools";

/*
signupHandler

Handler for POST /auth/register.
Registers a new user in Cognito with attributes for role, grade, and optional school.

Flow:
- Parse and validate body (email, password, firstName, lastName, role, grade, school info).
- Resolve school either by schoolId or by name/country/city.
- Students: must resolve to a valid school; instructors may skip for now.
- Build Cognito user attributes (role, grade, and school if available).
- Call Cognito signUp with normalized email and password.
- On success:
  - If instructor without school → return note + needsSchoolRegistration=true.
  - Else → return generic signup success message.
- On failure: map common Cognito errors.

Error codes:
- 400 → invalid JSON, invalid input, weak password, or school not found
- 409 → EMAIL_ALREADY_REGISTERED
*/

const cognito = new AWS.CognitoIdentityServiceProvider();

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).trim(),
  lastName: z.string().min(1).trim(),
  role: z.enum(["student", "instructor"]),
  grade: z.string().min(1).trim(),
  // Either a direct id...
  schoolId: z.string().min(1).trim().optional(),
  // ...or name-based fields the backend can resolve:
  schoolName: z.string().min(1).trim().optional(),
  countryCode: z.string().length(2).trim().optional(),
  city: z.string().min(1).trim().optional(),
});

export const signupHandler: APIGatewayProxyHandler = async (event) => {
  // Parse & validate
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

  const {
    email,
    password,
    firstName,
    lastName,
    role,
    grade,
    schoolId,
    schoolName,
    countryCode,
    city,
  } = parsed.data;

  const emailNorm = email.trim().toLowerCase();
  const isInstructor = role === "instructor";
  const isStudent = role === "student";

  // Resolve school using either schoolId OR (schoolName + optional country/city)
  const { school, reason } = await resolveSchool({
    schoolId,
    schoolName,
    countryCode,
    city,
  });

  // Students must resolve to a real school
  if (isStudent && !school) {
    // More specific error if an explicit ID was invalid
    if (schoolId && reason === "NOT_FOUND") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "INVALID_SCHOOL_ID" }),
      };
    }
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "SCHOOL_AMBIGUOUS_OR_NOT_FOUND" }),
    };
  }

  // Build Cognito attributes
  const userAttributes: AWS.CognitoIdentityServiceProvider.AttributeType[] = [
    { Name: "email", Value: emailNorm },
    { Name: "given_name", Value: firstName },
    { Name: "family_name", Value: lastName },
    { Name: "custom:role", Value: role },
    { Name: "custom:grade", Value: grade },
  ];

  // Only set school attributes if we have a resolved school (instructor may not yet)
  if (school) {
    userAttributes.push(
      { Name: "custom:schoolId", Value: school.schoolId },
      { Name: "custom:school", Value: school.name }
    );
  }

  try {
    await cognito
      .signUp({
        ClientId: process.env.CLIENT_ID!,
        Username: emailNorm,
        Password: password,
        UserAttributes: userAttributes,
      })
      .promise();

    // Tailored success message
    const base = { message: "Signup successful. Please confirm your account." };
    if (isInstructor && !school) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ...base,
          note: "After confirming your account, please register your school so students can join.",
          needsSchoolRegistration: true,
        }),
      };
    }

    return { statusCode: 200, body: JSON.stringify(base) };
  } catch (err: any) {
    const code = err?.code || err?.name;
    if (code === "UsernameExistsException") {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: "EMAIL_ALREADY_REGISTERED" }),
      };
    }
    if (code === "InvalidPasswordException") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "WEAK_PASSWORD" }),
      };
    }
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err?.message || "Signup failed" }),
    };
  }
};
