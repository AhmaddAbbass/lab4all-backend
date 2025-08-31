import { APIGatewayProxyHandler } from "aws-lambda";
import { getMembershipRecord } from "../../utils/database/memberships/fetchMembership";
import { removeMembershipBothWays } from "../../utils/database/memberships/removeMembershipBothWays";
import { getStudentIDsByClassroom } from "../../utils/database/classrooms/fetchStudentIDs";
import { deleteClassroomWithMembership } from "../../utils/database/classrooms/deleteClassroomWithMembership";

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
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

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
      body: JSON.stringify({ error: "MEMBERSHIP_NOT_FOUND" }),
    };

  const role = meToClass.role as "student" | "instructor";

  try {
    if (role === "student") {
      await removeMembershipBothWays(userId, classroomID);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Left classroom" }),
      };
    }

    // instructor
    const studentIds = await getStudentIDsByClassroom(classroomID); // already filters role=student
    if (studentIds.length > 0) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: "INSTRUCTOR_CANNOT_LEAVE_WHEN_MEMBERS_PRESENT",
        }),
      };
    }

    // no students: delete instructor membership + classroom atomically
    await deleteClassroomWithMembership(userId, classroomID);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Classroom deleted" }),
    };
  } catch (err: any) {
    console.error("leave error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
