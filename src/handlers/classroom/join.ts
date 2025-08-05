import { APIGatewayProxyHandler } from 'aws-lambda';
import z from 'zod';
import { getClassroomByJoinCode } from '../../utils/database/fetchClassroomByJC';
import { insertMembershipRecord} from '../../utils/database/insertMembership';
import { getMembershipRecord } from '../../utils/database/fetchMembership';
import { MembershipSchema } from '../../schemas/membership';

/*
  Assumptions:
  - GSI on joinCode allows efficient lookup
  - Membership table stores bidirectional PK/SK
*/

const requestBodySchema = z.object({
  joinCode: z.string()
});

export const joinClassroomHandler: APIGatewayProxyHandler = async (event) => {
  try {
    const claims = (event.requestContext.authorizer as any)?.claims;
    if (!claims) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const userId = claims.sub; 

    const body = JSON.parse(event.body || '{}');
    const parsedBody = requestBodySchema.safeParse(body);
    if (!parsedBody.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request body' }),
      };
    }

    const { joinCode } = parsedBody.data;
    const classroom = await getClassroomByJoinCode(joinCode);

    if (!classroom || classroom.joinCode !== joinCode) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Invalid join code' }),
      };
    }
    // console.log("Classroom object:", classroom);
    const classroomID = classroom.classroomID;

    // Check if the user is already a member
    const existing = await getMembershipRecord(`USER#${userId}`, `CLASSROOM#${classroomID}`);
    if (existing) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'User already joined this classroom' }),
      };
    }

    const timestamp = new Date().toISOString();

    const membership1 = MembershipSchema.parse({
      PK: `USER#${userId}`,
      SK: `CLASSROOM#${classroomID}`,
      role: 'student',
      joinedAt: timestamp,
    });

    const membership2 = MembershipSchema.parse({
      PK: `CLASSROOM#${classroomID}`,
      SK: `USER#${userId}`,
      role: 'student',
      joinedAt: timestamp,
    });
//     console.log("Membership1 PK:", membership1.PK);
//     console.log("Membership1 SK:", membership1.SK);

    await insertMembershipRecord(membership1);
    await insertMembershipRecord(membership2);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully joined classroom' }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
