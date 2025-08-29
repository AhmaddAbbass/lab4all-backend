/**
 * Query DynamoDB for the *next* page of announcements for a classroom.
 * AWS **SDK v2** – expects an injected DocumentClient (makes unit-testing easier).
 *
 *   • PK = "CLASS#{classId}"
 *   • SK = "ANNOUNCEMENT#<ISO-date>#<uuid>"
 *   • Latest first → ScanIndexForward: false
 *
 * If `cursor` is provided it should be that full SK string returned earlier;
 * we pass it as `ExclusiveStartKey` so Dynamo continues *after* it.
 */

import type AWS from "aws-sdk";
import { AnnouncementItem, type AnnouncementItem as AnnItem } from "../../../schemas/announcements/AnnItem";
import { dobClient } from "../dynamo";
interface Params {
  classID: string;
  limit: number;          // 1-50 – already range-checked by the handler
  cursor?: string;        // last SK we already sent to the client
}

export async function fetchAnnouncements({
  classID,
  limit,
  cursor,
}: Params): Promise<{ items: AnnItem[]; lastEvaluatedKey?: string }> {
  const pk = `CLASS#${classID}`;   // matches the write-side pattern

  const params: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: process.env.ANNOUNCEMENTS_TABLE!,
    KeyConditionExpression: "PK = :pk",          // we rely on prefix sort + ScanIndexForward
    ExpressionAttributeValues: { ":pk": pk },
    Limit: limit,
    ScanIndexForward: false,                     // newest → oldest
  };

  if (cursor) {
    params.ExclusiveStartKey = { PK: pk, SK: cursor };
  }

  const result = await dobClient.query(params).promise();

  // Runtime validation (helpful while developing/testing)
  const parsed = result.Items?.map((i) => AnnouncementItem.parse(i)) ?? [];

  return {
    items: parsed,
    lastEvaluatedKey: result.LastEvaluatedKey?.SK as string | undefined,
  };
}
