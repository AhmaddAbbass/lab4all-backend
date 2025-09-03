import { APIGatewayProxyHandler } from "aws-lambda";
import { ZodError } from "zod";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  FreeStepRequestSchema,
  FreeStepResponseSchema,
} from "../../schemas/free/stepio";
import { DEFAULT_HEADERS } from "../../utils/headers/defaults";
import { checkUserMembership } from "../../utils/database/memberships/checkMembership";
import { llmStep } from "../../utils/free/llm";

// Dynamo
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Env helpers
const prices = () => ({
  inMicro: parseInt(process.env.TOKENS_IN_PRICE_MICROUSD || "0", 10), // µUSD/token
  outMicro: parseInt(process.env.TOKENS_OUT_PRICE_MICROUSD || "0", 10), // µUSD/token
});
const monthKey = (d = new Date()) => `MO#${d.toISOString().slice(0, 7)}`; // YYYY-MM

type UsageRow = {
  requests?: number;
  tokensIn?: number;
  tokensOut?: number;
  costMicroUSD?: number;
};

async function getClassroomQuotaMicroUSD(classroomId: string): Promise<number> {
  const table = process.env.CLASSROOMS_TABLE!;
  const res = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { classroomID: classroomId }, // stored field is classroomID
      ProjectionExpression: "llmQuotaCents",
    })
  );
  const cents =
    (res.Item?.llmQuotaCents as number | undefined) ??
    parseInt(process.env.CLASS_QUOTA_CENTS_DEFAULT || "0", 10);
  return cents * 10_000;
}

async function getUsage(classroomId: string): Promise<UsageRow> {
  const table = process.env.LLM_USAGE_TABLE || "llm_usage";
  const res = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { PK: `CLASS#${classroomId}`, SK: monthKey() },
      ProjectionExpression: "requests, tokensIn, tokensOut, costMicroUSD",
    })
  );
  return {
    requests: res.Item?.requests ?? 0,
    tokensIn: res.Item?.tokensIn ?? 0,
    tokensOut: res.Item?.tokensOut ?? 0,
    costMicroUSD: res.Item?.costMicroUSD ?? 0,
  };
}

async function addUsage(
  classroomId: string,
  delta: { req: number; inTok: number; outTok: number; costMicroUSD: number }
) {
  const table = process.env.LLM_USAGE_TABLE || "llm_usage";
  await ddb.send(
    new UpdateCommand({
      TableName: table,
      Key: { PK: `CLASS#${classroomId}`, SK: monthKey() },
      UpdateExpression: "ADD #r :r, #in :in, #out :out, #c :c",
      ExpressionAttributeNames: {
        "#r": "requests",
        "#in": "tokensIn",
        "#out": "tokensOut",
        "#c": "costMicroUSD",
      },
      ExpressionAttributeValues: {
        ":r": delta.req,
        ":in": delta.inTok,
        ":out": delta.outTok,
        ":c": delta.costMicroUSD,
      },
    })
  );
}

export const stepHandler: APIGatewayProxyHandler = async (event) => {
  try {
    // claims (same pattern you already use elsewhere)
    const claims = (event.requestContext.authorizer as any)?.claims as
      | Record<string, string>
      | undefined;

    if (!claims?.sub) {
      return {
        statusCode: 401,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }
    const userId = claims.sub;

    // body parse
    if (!event.body) {
      return {
        statusCode: 400,
        headers: DEFAULT_HEADERS,
        body: "Missing body",
      };
    }
    const req = FreeStepRequestSchema.parse(JSON.parse(event.body));

    // classroom membership
    const isMember = await checkUserMembership(userId, req.classroomId);
    if (!isMember) {
      return {
        statusCode: 403,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: "FORBIDDEN" }),
      };
    }

    // quota precheck
    const quota = await getClassroomQuotaMicroUSD(req.classroomId);
    const usage = await getUsage(req.classroomId);
    if ((usage.costMicroUSD ?? 0) >= quota) {
      return {
        statusCode: 402,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({
          error: "QUOTA_EXCEEDED",
          quotaExceeded: true,
          usage: {
            costMicroUSD: usage.costMicroUSD ?? 0,
            quotaMicroUSD: quota,
            month: monthKey(),
          },
        }),
      };
    }

    // LLM call
    const { postAction, uiEvents, tokensIn, tokensOut } = await llmStep({
      env: req.env,
      action: req.action,
      history: req.history,
    });

    // cost calc + persist
    const { inMicro, outMicro } = prices();
    const deltaCostMicroUSD = Math.max(
      0,
      (tokensIn || 0) * inMicro + (tokensOut || 0) * outMicro
    );

    await addUsage(req.classroomId, {
      req: 1,
      inTok: tokensIn || 0,
      outTok: tokensOut || 0,
      costMicroUSD: deltaCostMicroUSD,
    });

    const newTotal = (usage.costMicroUSD ?? 0) + deltaCostMicroUSD;
    const quotaExceeded = newTotal > quota;

    // validate envelope and return
    const base = FreeStepResponseSchema.parse({
      postAction,
      uiEvents,
      tokensIn,
      tokensOut,
    });

    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ ...base, quotaExceeded }),
    };
  } catch (err: any) {
    if (err instanceof ZodError) {
      return {
        statusCode: 400,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: "Invalid input", details: err.errors }),
      };
    }
    console.error("free/step error", err);
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "Internal error" }),
    };
  }
};
