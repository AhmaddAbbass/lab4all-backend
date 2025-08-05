import { APIGatewayProxyHandler } from 'aws-lambda';
import { getStudentIDsByClassroom } from '../../utils/database/fetchStudentIDs';
import { fetchStudentInfo } from '../../utils/userpool/fetchStudentInfo';

export const getMembersHandler: APIGatewayProxyHandler = async (event) => {
  console.log('Raw event.body:', event.body);
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const body = JSON.parse(event.body || '{}');
  console.log('Parsed body:', body); // Debug

  const classroomID = body.classroomID;

  if (!classroomID) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing classroomID in request body' }),
    };
  }

  try {
    // Step 1: Get list of student IDs from the membership DB
    const studentIds = await getStudentIDsByClassroom(classroomID);

    // Step 2: Get full user info from Cognito for each ID
    console.log('Fetching info for IDs:', studentIds);

  const members = await Promise.all(
  studentIds.map(async (id) => {
    console.log(`Fetching user ${id}`);
    const userInfo = await fetchStudentInfo(id);
    console.log(`Fetched user ${id}`);
    return userInfo;
  })
);
    const filtered = members.filter(Boolean); // Remove nulls if any failed
    return {
      statusCode: 200,
      body: JSON.stringify({ members: filtered }),
    };
  } catch (err) {
    console.error('Error fetching members:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
