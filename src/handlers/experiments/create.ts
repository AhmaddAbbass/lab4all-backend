import { APIGatewayProxyHandler } from "aws-lambda";
import {
  ExperimentCreateInput,
  ExperimentCreateSchema,
} from "../../schemas/experiments/ExpCreateSchema";
import {
  ExperimentItemSchema,
  ExperimentItem,
} from "../../schemas/experiments/ExpItem";
import { randomUUID } from "crypto";
import { insertExperimentRecord } from "../../utils/database/experiments/insertExperiment";
export const createExperimentHandler: APIGatewayProxyHandler = async (
  event
) => {
  // 1. JWT claims
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }
  const userId = claims.sub;

  // 2. Validate request body
  if (!event.body) return { statusCode: 400, body: "Missing request body" };
  // 3. Input validation
  let input: ExperimentCreateInput;
  try {
    input = ExperimentCreateSchema.parse(JSON.parse(event.body));
  } catch (err: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid input", details: err.errors }),
    };
  }
  // 4. Prepare dynamo record
  const createdAt = new Date().toISOString();
  const experimentId = `EXP#${createdAt}#${randomUUID()}`;
  const pk = `CLASS#${input.classId}`;
  const sk = experimentId;
  const owner = `USER#${userId}`;
  const s3Key = `class/${input.classId}/experiment/${experimentId}/info.txt`;

  const dbItem: ExperimentItem = ExperimentItemSchema.parse({
    PK: pk,
    SK: sk,

    classId: input.classId,
    experimentId,
    userId: owner,
    ownerRole: claims["custom:role"],

    prototypeId: input.prototypeId,
    title: input.title,
    createdAt,

    pending: true,
    hiddenByTeacher: false,
    hiddenByOwner: false,

    s3Key,

    GSI1PK: owner,
    GSI1SK: sk, // reuse SK for chrono-order in the GSI
  });
  // 5. insert experiment record (with pending-limit guard)
  try {
    console.log(
      "Inserting into",
      process.env.EXPERIMENTS_TABLE,
      JSON.stringify(dbItem, null, 2)
    );
    await insertExperimentRecord(dbItem);
  } catch (err: any) {
    if (err.message === "Pending experiment limit reached")
      return { statusCode: 409, body: err.message }; // 409 Conflict
    console.error("Dynamo error:", err);
    return { statusCode: 500, body: "Internal error" };
  }

  return {
    statusCode: 201,
    body: JSON.stringify({ experimentId: dbItem.experimentId }),
  };
};
