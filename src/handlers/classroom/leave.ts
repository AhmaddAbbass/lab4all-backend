import { APIGatewayProxyHandler } from "aws-lambda";
import { getMembershipRecord } from "../../utils/database/memberships/fetchMembership";
import { removeMembershipBothWays } from "../../utils/database/memberships/removeMembershipBothWays";
import { getStudentIDsByClassroom } from "../../utils/database/classrooms/fetchStudentIDs";
import { deleteClassroomWithMembership } from "../../utils/database/classrooms/deleteClassroomWithMembership";
import { DEFAULT_HEADERS } from "../../utils/headers/defaults";

/*
deleteMembershipHandler

Handler for DELETE /classroom/membership.
Allows a user to leave a classroom or, if instructor, delete the classroom.

Flow:
- Validate Cognito claims → must be authenticated user.
- Parse body for classroomID.
- Fetch membership record for (user, classroom).
- If not found → return 404.
- If role = student:
  - Remove membership edges (student ↔ classroom).
  - Return "Left classroom".
- If role = instructor:
  - Check if any students remain in the classroom.
  - If students exist → return 409 (cannot leave while members present).
  - If none → delete classroom + instructor membership atomically.
  - Return "Classroom deleted".

Error codes:
- 400 → missing classroomID
- 401 → unauthorized (no claims)
- 404 → membership not found
- 409 → instructor cannot leave while students are still members
- 500 → internal server error
*/

/**
 * DELETE /classroom/membership
 * Body: { classroomID }
 * - student: removes their membership
 * - instructor: allowed only if there are NO students; if so, deletes classroom too
 */
export const deleteMembershipHandler: APIGatewayProxyHandler = async (
  event
) => {
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims)
    return {
      statusCode: 401,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "Unauthorized" }),
    };

  let body: any = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    /* ignore, handled below */
  }
  const classroomID = body.classroomID;
  if (!classroomID)
    return {
      statusCode: 400,
      headers: DEFAULT_HEADERS,

      body: JSON.stringify({ error: "MISSING_CLASSROOM_ID" }),
    };

  const userId = claims.sub;

  // check membership + role
  const meToClass = await getMembershipRecord(
    `USER#${userId}`,
    `CLASSROOM#${classroomID}`
  );
  if (!meToClass)
    return {
      statusCode: 404,
      headers: DEFAULT_HEADERS,

      body: JSON.stringify({ error: "MEMBERSHIP_NOT_FOUND" }),
    };

  const role = meToClass.role as "student" | "instructor";

  try {
    if (role === "student") {
      await removeMembershipBothWays(userId, classroomID);
      return {
        statusCode: 200,
        headers: DEFAULT_HEADERS,

        body: JSON.stringify({ message: "Left classroom" }),
      };
    }

    // instructor
    const studentIds = await getStudentIDsByClassroom(classroomID); // already filters role=student
    if (studentIds.length > 0) {
      return {
        statusCode: 409,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({
          error: "INSTRUCTOR_CANNOT_LEAVE_WHEN_MEMBERS_PRESENT",
        }),
      };
    }

    // no students: delete instructor membership + classroom atomically
    await deleteClassroomWithMembership(userId, classroomID);
    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,

      body: JSON.stringify({ message: "Classroom deleted" }),
    };
  } catch (err: any) {
    console.error("leave error:", err);
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS,

      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
