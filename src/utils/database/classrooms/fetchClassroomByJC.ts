//fetchClassroomByJC
import { dobClient } from '../dynamo';

export const getClassroomByJoinCode = async (joinCode: string) => {
  const result = await dobClient.query({
    TableName: 'classrooms',
    IndexName: 'joinCode-index',
    KeyConditionExpression: 'joinCode = :jc',
    ExpressionAttributeValues: {
      ':jc': joinCode
    }
  }).promise();

  // Assumes joinCode is unique — return the first match
  return result.Items?.[0] || null;
};
