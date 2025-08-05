// lib/dynamo.ts
import AWS from 'aws-sdk';

export const dobClient = new AWS.DynamoDB.DocumentClient();