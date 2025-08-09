import { APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { ClassroomSchema } from '../../schemas/classroom';
import { insertClassroomRecord } from '../../utils/database/insertClassroom';
import { generateJoinCode } from '../../utils/other/generateJoinCode';
import { insertMembershipRecord } from "../../utils/database/insertMembership";
/**
 * POST /classroom/create
 *
 * Creates a new classroom.
 *
 * Authorization: Requires a valid Cognito JWT (teacher role).
 * Request Body (JSON):
 * {
 *   "classroomName": "Physics 101",
 *   "school": "International College Beirut"
 * }
 *
 * The `teacherId` and `teacherName` are extracted from the Cognito token.
 * The following fields are generated server-side:
 *  - classroomID: UUID
 *  - createdAt: ISO timestamp
 *  - joinCode: Last 8 digits of timestamp (or another strategy)
 *
 * Example Full Classroom Object (saved to DynamoDB):
 * {
 *   "classroomID": "uuid-...",
 *   "classroomName": "Physics 101",
 *   "school": "International College Beirut",
 *   "createdAt": "2025-08-01T09:15:30.150Z",
 *   "teacherId": "auth0|abcd1234",
 *   "teacherName": "mona.ahmad",
 *   "joinCode": "12345678"
 * }
 */

export const createClassroomHandler: APIGatewayProxyHandler = async (event) => {
  // Since the dynamo functions are imported from utils, we can assume the DynamoDB client is already set up.
  // We only need to prepare the info for the injection and use the api request body well. 

  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }
  const userProfile = {
    userId: claims.sub,
    email:  claims.email,
    role:   claims['custom:role'],
    school: claims['custom:school'],
    grade:  claims['custom:grade'],
  };
  if (userProfile.role !== 'instructor') {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Only teachers can create classrooms' }),
    };
  }

  
  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }
  console.log('Step 2 – parsed body:', body);                       // <─ NEW
  const joinCode= generateJoinCode();
  const classroomRecord = {
    classroomID: uuidv4(),
    classroomName: body.classroomName,
    school: body.school,
    createdAt: new Date().toISOString(),
    teacherId: userProfile.userId,
    teacherName: claims['given_name'] +' '+ claims['family_name'] ,
    joinCode: joinCode,
  };

  // Validate input
  const validation = ClassroomSchema.safeParse(classroomRecord); // this validation uses zod 
  if (!validation.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Validation failed', details: validation.error.format() }),
    };
  }

  // Insert into DynamoDB
    console.log('Step 3 – about to call insertClassroomRecord');      // <─ NEW

  try {
    await insertClassroomRecord(validation.data);
    await insertMembershipRecord({
      PK: `USER#${validation.data.teacherId}`,
      SK: `CLASSROOM#${validation.data.classroomID}`,
      role: "instructor",
      joinedAt : validation.data.createdAt // using the same createdAt timestamp
    });

    await insertMembershipRecord({
      PK: `CLASSROOM#${validation.data.classroomID}`,
      SK: `USER#${validation.data.teacherId}`,
      role: "instructor",
      joinedAt : validation.data.createdAt // using the same createdAt timestamp

    });
    
    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Classroom created', classroomID: validation.data.classroomID,joinCode: joinCode }),
    };
  } catch (err) {
        console.error('Step 4 – insert ERROR:', err);                   // <─ NEW

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to insert classroom' }),
    };
  }
};