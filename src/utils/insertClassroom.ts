// utils/dynamoInsert.ts
import { dobClient } from './dynamo';
import { Classroom, ClassroomSchema } from '../schemas/classroom';

export const insertClassroomRecord = async (input: unknown): Promise<void> => {
  const result = ClassroomSchema.safeParse(input);

  if (!result.success) {
    throw new Error(`Validation failed: ${JSON.stringify(result.error.format())}`);
  }

  const classroom: Classroom = result.data;

  try {
      console.log('Step 3a – Dynamo request ready:', classroom);        // <─ NEW

    await dobClient.put({
      TableName: 'classrooms',
      Item: classroom,
      ConditionExpression: 'attribute_not_exists(classroomId)', // ensures no overwrite 

    }).promise();
      console.log('Step 3b – Dynamo put() returned');                   // <─ NEW

  } catch (err: any) {
    throw new Error(`Failed to insert classroom: ${err.message || err}`);
  }
};
