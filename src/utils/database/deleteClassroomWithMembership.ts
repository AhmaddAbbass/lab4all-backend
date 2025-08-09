import { dobClient } from './dynamo';

/**
 * Deletes instructor <-> classroom memberships and the classroom item atomically.
 * Used when instructor leaves and there are no students.
 */
export const deleteClassroomWithMembership = async (instructorSub: string, classroomID: string) => {
  await dobClient.transactWrite({
    TransactItems: [
      {
        Delete: {
          TableName: 'memberships',
          Key: { PK: `USER#${instructorSub}`, SK: `CLASSROOM#${classroomID}` },
          ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)'
        }
      },
      {
        Delete: {
          TableName: 'memberships',
          Key: { PK: `CLASSROOM#${classroomID}`, SK: `USER#${instructorSub}` },
          ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)'
        }
      },
      {
        Delete: {
          TableName: 'classrooms',
          Key: { classroomID },
          ConditionExpression: 'attribute_exists(classroomID)'
        }
      }
    ]
  }).promise();
};
