// utils/membership/checkMembership.ts
import { dobClient } from "./dynamo";

// Looks up a membership record in the memberships table
export const checkUserMembership = async (
  userId: string,
  classroomId: string
): Promise<boolean> => {
  try {
    const resp = await dobClient
      .get({
        TableName: "memberships",
        Key: {
          PK: `USER#${userId}`,
          SK: `CLASSROOM#${classroomId}`,
        },
      })
      .promise();

    return !!resp.Item; // true if membership exists
  } catch (err: any) {
    console.error("checkUserMembership failed:", err);
    return false;
  }
};
