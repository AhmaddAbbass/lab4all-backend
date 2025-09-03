import { APIGatewayProxyHandler } from "aws-lambda";
import { generateJoinCode } from "../../utils/other/generateJoinCode";
import { getClassroomByID } from "../../utils/database/classrooms/fetchClassroomByID";
import { updateClassroomJoinCode } from "../../utils/database/classrooms/updateClassroomJC";

/*
refreshJoinCodeHandler

Handler for POST /classroom/refreshjc.
Allows the class owner (instructor) to refresh their classroom’s join code.

Flow:
- Validate Cognito claims → must be authenticated user.
- Parse body for classroomID (field: classId).
- Fetch classroom by ID.
- Verify that the requesting user is the class owner (teacherId match).
- Generate a new join code.
- Update classroom record in DB with new code.
- Return the new join code.

Error codes:
- 400 → invalid JSON body or missing classroomID
- 401 → unauthorized (no claims)
- 403 → user is not the classroom owner
- 404 → classroom not found
- 500 → internal server error
*/

export const refreshJoinCodeHandler: APIGatewayProxyHandler = async (event) => {
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body: any;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const classroomID = body.classId;
  if (!classroomID) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing classroomID in request body" }),
    };
  }

  try {
    const classroom = await getClassroomByID(classroomID);
    if (!classroom)
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Classroom not found" }),
      };

    if (classroom.teacherId !== claims.sub) {
      return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
    }

    const newJoinCode = generateJoinCode();
    await updateClassroomJoinCode(classroomID, newJoinCode);

    return { statusCode: 200, body: JSON.stringify({ joinCode: newJoinCode }) };
  } catch (err) {
    console.error("Error refreshing join code:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
