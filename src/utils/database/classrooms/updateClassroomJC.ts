import { dobClient } from "../dynamo";

export const updateClassroomJoinCode = async (
  classroomID: string,
  newJoinCode: string
) => {
  try {
    const result = await dobClient
      .update({
        TableName: process.env.CLASSROOMS_TABLE!, // use env instead of hardcoded
        Key: { classroomID }, // PK is classroomID
        UpdateExpression: "SET joinCode = :newJoinCode",
        ExpressionAttributeValues: {
          ":newJoinCode": newJoinCode,
        },
        ConditionExpression: "attribute_exists(classroomID)", // don’t update if not found
        ReturnValues: "ALL_NEW", // return the updated record
      })
      .promise();

    return result.Attributes;
  } catch (error) {
    console.error("Error updating classroom join code:", error);
    throw new Error("Could not update classroom join code");
  }
};
