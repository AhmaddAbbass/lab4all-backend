import { APIGatewayProxyHandler } from "aws-lambda";
import { getClassroomIDsForUser } from "../../utils/database/classrooms/fetchClassroomIDs";
import { getClassroomByID } from "../../utils/database/classrooms/fetchClassroomByID";

/*
getMyClassroomsHandler

Handler for GET /classroom/list.
Returns all classrooms the authenticated user belongs to.

Flow:
- Validate Cognito claims → must be authenticated user.
- Fetch classroom IDs linked to the user (via memberships).
- For each classroomId → fetch classroom record from DB.
- Remove teacherId field before returning (privacy).
- Return array of classroom objects.

Error codes:
- 401 → unauthorized (no claims)
- 500 → internal error while fetching classrooms
*/

export const getMyClassroomsHandler: APIGatewayProxyHandler = async (event) => {
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  const userId = claims.sub;

  try {
    const classroomIds = await getClassroomIDsForUser(userId);

    const classrooms = await Promise.all(
      classroomIds.map(async (id) => {
        const classroom = await getClassroomByID(id);
        if (!classroom) return null;

        const { teacherId, ...rest } = classroom; // returning all but teacherId
        return rest;
      })
    );
    const filtered = classrooms.filter(Boolean);

    return {
      statusCode: 200,
      body: JSON.stringify(filtered),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Internal server error" }),
    };
  }
};
