import { APIGatewayProxyHandler } from "aws-lambda";
import { getMembershipRecord } from "../../utils/database/memberships/fetchMembership";
import { removeMembershipBothWays } from "../../utils/database/memberships/removeMembershipBothWays";

/*
kickStudentHandler

Handler for POST /classroom/kick.
Allows an instructor to remove a student from their classroom.

Flow:
- Validate Cognito claims → must be authenticated.
- Parse body for classroomID and studentId.
- Verify requester is an instructor member of the classroom.
- Verify target is a student member of the classroom.
- Remove membership edges (student ↔ classroom) using removeMembershipBothWays.
- Return success message.

Error codes:
- 400 → missing fields in body
- 401 → unauthorized (no claims)
- 403 → requester not an instructor
- 404 → student not found in classroom
- 500 → internal server error
*/

/**
 * POST /classroom/kick
 * Body: { classroomID, studentId }
 * Only an instructor of that classroom can kick a student.
 */
export const kickStudentHandler: APIGatewayProxyHandler = async (event) => {
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims)
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  let body: any = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {}
  const { classroomID, studentId } = body || {};
  if (!classroomID || !studentId)
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "MISSING_FIELDS" }),
    };

  const me = claims.sub;

  // verify requester is instructor in this class
  const meMember = await getMembershipRecord(
    `USER#${me}`,
    `CLASSROOM#${classroomID}`
  );
  if (!meMember || meMember.role !== "instructor") {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "INSTRUCTOR_ONLY" }),
    };
  }

  // verify target is a student member
  const targetMember = await getMembershipRecord(
    `USER#${studentId}`,
    `CLASSROOM#${classroomID}`
  );
  if (!targetMember || targetMember.role !== "student") {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "STUDENT_NOT_FOUND" }),
    };
  }

  try {
    await removeMembershipBothWays(studentId, classroomID);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Student removed" }),
    };
  } catch (err) {
    console.error("kick error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
