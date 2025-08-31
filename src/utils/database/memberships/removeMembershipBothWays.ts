import { dobClient } from '../dynamo';

export const removeMembershipBothWays = async (userSub: string, classroomID: string) => {
  await dobClient.transactWrite({
    TransactItems: [
      {
        Delete: {
          TableName: 'memberships',
          Key: { PK: `USER#${userSub}`, SK: `CLASSROOM#${classroomID}` },
          ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)'
        }
      },
      {
        Delete: {
          TableName: 'memberships',
          Key: { PK: `CLASSROOM#${classroomID}`, SK: `USER#${userSub}` },
          ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)'
        }
      }
    ]
  }).promise();
};
