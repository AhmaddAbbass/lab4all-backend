import { dobClient } from "../dynamo";
import {
  AnnouncementItem as AnnItemSchema,
  type AnnouncementItem as AnnouncementItemType,
} from "../../../schemas/announcements/AnnItem";

/**
 * Inserts an announcement item conditionally (no overwrite).
 * Validates shape with Zod before writing.
 */
export const insertAnnouncementRecord = async (input: unknown): Promise<void> => {
  const parsed = AnnItemSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${JSON.stringify(parsed.error.format())}`);
  }

  const item: AnnouncementItemType = parsed.data;

  try {
    await dobClient
      .put({
        TableName: process.env.ANNOUNCEMENTS_TABLE!, // e.g. "announcements"
        Item: item,
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
      .promise();
  } catch (err: any) {
    if (err.code === "ConditionalCheckFailedException") {
      throw new Error("Announcement already exists (PK/SK collision).");
    }
    throw new Error(`Failed to insert announcement: ${err.message || err}`);
  }
};
