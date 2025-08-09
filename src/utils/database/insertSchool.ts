import { dobClient } from './dynamo';

export const putSchool = async (school: {
  schoolId: string;
  name: string;
  countryCode: string;
  city: string;
  nameSlug: string;
  citySlug: string;
  ccCity: string;
  createdAt: string;
  createdBy: string;
}) => {
  // add global partition key so we can list all schools alphabetically
  const item = { gpk: 'SCHOOL', ...school };

  await dobClient.put({
    TableName: process.env.SCHOOLS_TABLE!,
    Item: item,
    ConditionExpression: 'attribute_not_exists(schoolId)'
  }).promise();
};
