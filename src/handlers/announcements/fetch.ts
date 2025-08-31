// src/handlers/announcements/fetch.ts
// -----------------------------------
// Lambda GET /announcements/fetch?classID=…&k=…&cursor=…
//
// 1. Validate query-string input with Zod.
// 2. Pull next page of announcements (newest → oldest) from Dynamo.
// 3. Attach presigned GET URLs for each file.
// 4. Return JSON: { announcements: […], nextCursor }

import { APIGatewayProxyHandler } from "aws-lambda";
import { AnnFetchSchema } from "../../schemas/announcements/AnnFetchSchema"; // zod schema
import { fetchAnnouncements } from "../../utils/database/announcements/queryAnnouncements";
import { presignGetUrl } from "../../utils/s3/s3announcements"; // v2 helper
import type { AnnouncementResponse } from "../../schemas/announcements/AnnResponse";
import type { AnnouncementItem as AnnItem } from "../../schemas/announcements/AnnItem";

/** Seconds → ISO string for “expiresAt” */
const signedUrlTTL = Number(process.env.SIGNED_URL_TTL ?? "600");
const calcExpiresAt = () =>
  new Date(Date.now() + signedUrlTTL * 1_000).toISOString();

export const fetchAnnouncementsHandler: APIGatewayProxyHandler = async (
  event
) => {
  try {
    const claims = event.requestContext?.authorizer?.claims;

    if (!claims) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized – no claims present" }),
      };
    }

    const userId = claims.sub; // unique Cognito user ID
    const userRole = claims["custom:role"]; // assuming you store role as a custom attribute

    /* 1. Validate query-string */
    const qs = event.queryStringParameters ?? {};
    const input = AnnFetchSchema.parse({
      classID: qs.classID,
      k: qs.k ? Number(qs.k) : 10,
      cursor: qs.cursor,
    });

    /* 2. Dynamo query */
    const { items, lastEvaluatedKey } = await fetchAnnouncements({
      classID: input.classID,
      limit: input.k,
      cursor: input.cursor,
    });

    /* 3. Shape → AnnouncementResponse[] */
    const announcements: AnnouncementResponse[] = items.map((it: AnnItem) => ({
      announcementId: it.announcementId,
      createdAt: it.createdAt,
      authorId: it.authorId,
      kind: it.kind,
      pinned: it.pinned,
      files: it.files.map((f) => ({
        role: f.role,
        filename: f.filename,
        url: presignGetUrl(f.key),
        expiresAt: calcExpiresAt(),
      })),
    }));

    /* 4. Return */
    return {
      statusCode: 200,
      body: JSON.stringify({
        announcements,
        nextCursor: lastEvaluatedKey ?? null,
      }),
    };
  } catch (err) {
    console.error("announcements/fetch error:", err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: (err as Error).message }),
    };
  }
};
