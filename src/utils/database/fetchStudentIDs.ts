import { dobClient } from './dynamo'; // from your v2 SDK setup

export const getStudentIDsByClassroom = async (classroomId: string): Promise<string[]> => {
  const PK = `CLASSROOM#${classroomId}`;

  const params = {
    TableName: 'memberships',
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': PK,
    },
  };

  try {
    const data = await dobClient.query(params).promise();

    if (!data.Items) return [];

    // Only keep items where SK starts with 'USER#'
    return data.Items
      .filter(item => item.SK.startsWith('USER#'))
      .map(item => item.SK.replace('USER#', ''));
  } catch (err) {
    console.error('Error querying student IDs:', err);
    throw err;
  }
};
