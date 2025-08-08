// fetchMembership

import { dobClient } from './dynamo';

export const getMembershipRecord = async (PK: string, SK: string) => {
  const result = await dobClient.get({
    TableName: 'memberships',
    Key: { PK, SK },
  }).promise();

  return result.Item || null;
};
