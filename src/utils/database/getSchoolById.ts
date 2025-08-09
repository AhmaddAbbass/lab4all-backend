import { dobClient } from './dynamo';

export const getSchoolById = async (schoolId: string) => {
  const res = await dobClient.get({
    TableName: 'schools',
    Key: { schoolId },
  }).promise();
  return res.Item || null;
};
