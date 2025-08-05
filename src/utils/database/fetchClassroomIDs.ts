import { dobClient } from './dynamo';
// This function returns a list of classroom IDs for a given user ID
export const getClassroomIDsForUser = async (userID: string): Promise<string[]> => {
  const result = await dobClient.query({
    TableName: 'memberships',
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `USER#${userID}`,
    }
  }).promise();

  const classroomIDs = result.Items
    ?.map(item => item.SK)
    .filter(sk => sk.startsWith('CLASSROOM#'))
    .map(sk => sk.split('#')[1]) || [];

  return classroomIDs;
};
