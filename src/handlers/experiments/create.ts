import { APIGatewayProxyHandler } from "aws-lambda";
import { DEFAULT_HEADERS } from "../../utils/headers/defaults";
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
/*
createExperimentHandler

Handler for POST /experiments/create.
Creates a new experiment record for a classroom.

Flow:
- Validate Cognito claims → must be authenticated user.
- Parse and validate request body against ExperimentCreateSchema.
- Generate identifiers:
  - experimentId = "EXP#<timestamp>#<uuid>"
  - PK = "CLASS#<classId>", SK = experimentId
  - owner = "USER#<sub>"
  - s3Key = "class/<classId>/experiment/<experimentId>/info.txt"
- Build DynamoDB item (ExperimentItem) with initial flags:
  - pending = true, hiddenByTeacher = false, hiddenByOwner = false
- Insert record into DynamoDB (guard prevents too many pending experiments).
- On success → return experimentId.

Error codes:
- 400 → missing/invalid body
- 401 → unauthorized (no claims)
- 409 → pending experiment limit reached
- 500 → DynamoDB insert or internal error
*/

export const createExperimentHandler: APIGatewayProxyHandler = async (
  event
) => {
  // 1. JWT claims
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return {
      statusCode: 401,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }
  const userId = claims.sub;

  // 2. Validate request body

  if (!event.body)
    return {
      statusCode: 400,
      headers: DEFAULT_HEADERS,
      body: "Missing request body",
    };
  // 3. Input validation
  let input: ExperimentCreateInput;
  try {
    input = ExperimentCreateSchema.parse(JSON.parse(event.body));
  } catch (err: any) {
    return {
      statusCode: 400,
      headers: DEFAULT_HEADERS,
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
      return { statusCode: 409, headers: DEFAULT_HEADERS, body: err.message }; // 409 Conflict
    console.error("Dynamo error:", err);
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS,
      body: "Internal error",
    };
  }

  return {
    statusCode: 201,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ experimentId: dbItem.experimentId }),
  };
};
