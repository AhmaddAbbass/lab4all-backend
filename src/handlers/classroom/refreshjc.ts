import { APIGatewayProxyHandler } from "aws-lambda";
import { generateJoinCode } from "../../utils/other/generateJoinCode";
import { getClassroomByID } from "../../utils/database/classrooms/fetchClassroomByID";
import { updateClassroomJoinCode } from "../../utils/database/classrooms/updateClassroomJC";
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

  const classroomID = body.classroomID;
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
