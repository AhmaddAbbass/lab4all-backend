// insertMembership
import { dobClient } from './dynamo';
import { Membership, MembershipSchema} from '../../schemas/membership';

export const insertMembershipRecord = async (input: unknown): Promise<void> => {
  const result = MembershipSchema.safeParse(input);

  if (!result.success) {
    throw new Error(`Validation failed: ${JSON.stringify(result.error.format())}`);
  }

  const membership: Membership = result.data;

  try {
      console.log('Step 3a – Dynamo request ready:', membership);        // <─ NEW

    await dobClient.put({
      TableName: 'memberships',
      Item: membership,
    ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)'

    }).promise();
      console.log('Step 3b – Dynamo put() returned');                   // <─ NEW

  } catch (err: any) {
    throw new Error(`Failed to insert membership: ${err.message || err}`);
  }
};
