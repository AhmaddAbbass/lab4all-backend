// src/utils/database/putMembershipBothWays.ts
import { dobClient } from './dynamo';

interface PutMembershipBothWaysInput {
  userId: string;
  classroomId: string;
  role: 'student' | 'instructor';
  joinedAt: string; // ISO timestamp
}

/**
 * Inserts the two membership edges (USER->CLASSROOM and CLASSROOM->USER)
 * in a single DynamoDB transaction with "no-overwrite" conditions.
 */
export const putMembershipBothWays = async (input: PutMembershipBothWaysInput): Promise<void> => {
  const { userId, classroomId, role, joinedAt } = input;

  const table = process.env.MEMBERSHIPS_TABLE!;
  if (!table) throw new Error('MEMBERSHIPS_TABLE env var is not set');

  await dobClient.transactWrite({
    TransactItems: [
      {
        Put: {
          TableName: table,
          Item: {
            PK: `USER#${userId}`,
            SK: `CLASSROOM#${classroomId}`,
            role,
            joinedAt,
          },
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        },
      },
      {
        Put: {
          TableName: table,
          Item: {
            PK: `CLASSROOM#${classroomId}`,
            SK: `USER#${userId}`,
            role,
            joinedAt,
          },
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        },
      },
    ],
  }).promise();
};
