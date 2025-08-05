import { APIGatewayProxyHandler } from 'aws-lambda';
import { getClassroomIDsForUser } from '../../utils/database/fetchClassroomIDs';
import { getClassroomByID } from '../../utils/database/fetchClassroomByID';

export const getMyClassroomsHandler: APIGatewayProxyHandler = async (event) => {
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
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
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
