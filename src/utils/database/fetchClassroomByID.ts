import { dobClient } from './dynamo';

export const getClassroomByID = async (classroomID: string) => {
  const result = await dobClient.get({
    TableName: 'classrooms',
    Key: {
      classroomID
    }
  }).promise();

  return result.Item || null;
};
