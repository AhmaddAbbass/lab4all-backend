import { APIGatewayProxyHandler } from "aws-lambda";
import { z } from "zod";
import { getClassroomByJoinCode } from "../../utils/database/classrooms/fetchClassroomByJC";
import { insertMembershipRecord } from "../../utils/database/memberships/insertMembership";
import { getMembershipRecord } from "../../utils/database/memberships/fetchMembership";
import { MembershipSchema } from "../../schemas/membership";
import { DEFAULT_HEADERS } from "../../utils/headers/defaults";

/*
joinClassroomHandler

Handler for POST /classroom/join.
Allows a student to join a classroom using a joinCode.

Flow:
- Validate Cognito claims → must be authenticated user.
- Parse request body (joinCode).
- Lookup classroom by joinCode (via GSI).
- Ensure classroom exists and matches joinCode.
- Verify student’s schoolId matches classroom’s schoolId.
- Check if membership already exists.
- If not, create bidirectional membership records (USER→CLASSROOM, CLASSROOM→USER).
- Return success message.

Error codes:
- 400 → invalid request body
- 401 → unauthorized (no claims)
- 403 → invalid join code or different school
- 409 → already a member
- 500 → internal server error
*/

const requestBodySchema = z.object({
  joinCode: z.string(),
});

export const joinClassroomHandler: APIGatewayProxyHandler = async (event) => {
  try {
    const claims = (event.requestContext.authorizer as any)?.claims;
    if (!claims) {
      return {
        statusCode: 401,
        headers: DEFAULT_HEADERS,

        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const userId = claims.sub;
    const studentSchoolId = claims["custom:schoolId"];

    const body = JSON.parse(event.body || "{}");
    const parsedBody = requestBodySchema.safeParse(body);
    if (!parsedBody.success) {
      return {
        statusCode: 400,
        headers: DEFAULT_HEADERS,

        body: JSON.stringify({ error: "Invalid request body" }),
      };
    }

    const { joinCode } = parsedBody.data;
    const classroom = await getClassroomByJoinCode(joinCode);

    if (!classroom || classroom.joinCode !== joinCode) {
      return {
        statusCode: 403,
        headers: DEFAULT_HEADERS,

        body: JSON.stringify({ error: "Invalid join code" }),
      };
    }

    if (!classroom.schoolId || classroom.schoolId !== studentSchoolId) {
      return {
        statusCode: 403,
        headers: DEFAULT_HEADERS,

        body: JSON.stringify({ error: "CANT_JOIN_DIFFERENT_SCHOOL" }),
      };
    }

    const classroomID = classroom.classroomID;

    // Check if the user is already a member
    const existing = await getMembershipRecord(
      `USER#${userId}`,
      `CLASSROOM#${classroomID}`
    );
    if (existing) {
      return {
        statusCode: 409,
        headers: DEFAULT_HEADERS,

        body: JSON.stringify({ error: "User already joined this classroom" }),
      };
    }

    const timestamp = new Date().toISOString();

    const membership1 = MembershipSchema.parse({
      PK: `USER#${userId}`,
      SK: `CLASSROOM#${classroomID}`,
      role: "student",
      joinedAt: timestamp,
    });

    const membership2 = MembershipSchema.parse({
      PK: `CLASSROOM#${classroomID}`,
      SK: `USER#${userId}`,
      role: "student",
      joinedAt: timestamp,
    });

    await insertMembershipRecord(membership1);
    await insertMembershipRecord(membership2);

    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,

      body: JSON.stringify({ message: "Successfully joined classroom" }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS,

      body: JSON.stringify({ error: err.message || "Internal server error" }),
    };
  }
};
