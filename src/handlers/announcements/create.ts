import { APIGatewayProxyHandler } from "aws-lambda";
import { AnnouncementCreateInput, AnnouncementCreateSchema } from "../../schemas/announcements/AnnCreateSchema";
import {checkUserMembership} from "../../utils/database/checkMembership"
import { randomUUID } from "crypto";
import {extFrom,safeName } from "../../utils/other/files"
import { AnnouncementItem } from "../../schemas/announcements/AnnItem";
import { insertAnnouncementRecord } from "../../utils/database/announcements/insertAnnouncement";
import { presignPutUrl } from "../../utils/s3/s3client";
// (later you’ll import your utils e.g. insertAnnouncement, makeFileKey, presignPutUrl, etc.)
export const createAnnouncementHandler: APIGatewayProxyHandler = async (event) => {
  try {
    // 1) Parse and validate body against schema
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing request body" }),
      };
    }

    let input: AnnouncementCreateInput;
    try {
      input = AnnouncementCreateSchema.parse(JSON.parse(event.body));
    } catch (err: any) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid input", details: err.errors ?? err.message }),
      };
    }
// 2) Verify the user’s auth (claims from Cognito authorizer)

    const claims = event.requestContext?.authorizer?.claims;

    if (!claims) {
    return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized – no claims present" }),
    };
    }

    const userId = claims.sub;          // unique Cognito user ID
    const userRole = claims["custom:role"]; // assuming you store role as a custom attribute

    // Ensure role is instructor
    if (userRole !== "instructor") {
    return {
        statusCode: 403,
        body: JSON.stringify({ error: "Only instructors can create announcements" }),
    };
    }

    // Ensure user is member of the given classroom
    // (pseudo util – you’ll implement this separately)
    const isMember = await checkUserMembership(userId, input.classroomId);

    if (!isMember) {
    return {
        statusCode: 403,
        body: JSON.stringify({ error: "User not a member of this classroom" }),
    };
    }
    // 3) Generate a new announcementId (UUID) + createdAt timestamp (ISO string)
    const announcementId = randomUUID();
    const createdAt = new Date().toISOString();
    // 4) Construct S3 keys for all files in input.filesMeta
    const classId = input.classroomId;
    const bodyMeta = input.filesMeta.find(f => f.role === "body")!;
    const bodyExt = extFrom(bodyMeta.filename) || "bin";
    const bodyKey = `announcements/class/${classId}/ann/${announcementId}/body.${bodyExt}`; // each announcement will only have on body -> no naming conflict 
// Build per-file S3 keys (use stable body key; UUID-prefixed attachments)
    const files = input.filesMeta.map(f =>
      f.role === "body"
        ? {
            role: "body" as const,
            key: bodyKey,
            filename: f.filename,
            contentType: f.contentType,
          }
        : {
            role: "attachment" as const,
            key: `announcements/class/${classId}/ann/${announcementId}/files/${randomUUID()}_${safeName(f.filename)}`,
            filename: f.filename,
            contentType: f.contentType,
          }
    );

    // 5) Build DynamoDB item (AnnouncementItem)
    // - PK = "CLASS#<classId>"
    // - SK = "ANNOUNCEMENT#<createdAt>#<announcementId>"
    // - Save announcementId, classId, createdAt, authorId, kind, pinned=false
    // - files = [{role, key, filename, contentType}, ...]
  const dbItem = {
    PK: `CLASS#${classId}`,
    SK: `ANNOUNCEMENT#${createdAt}#${announcementId}`,
    announcementId,
    classId,
    createdAt,
    authorId: userId,
    kind: "teacher",
    pinned: false,
    files, // [{ role, key, filename, contentType }, ...]
  };

  // Runtime guardrail (throws if shape is wrong)
  AnnouncementItem.parse(dbItem);
// 6) Insert item into DynamoDB (conditional put to avoid overwrites)
  await insertAnnouncementRecord(dbItem);

// 7) Generate presigned PUT URLs for each file
    const uploadUrls = await Promise.all(
      dbItem.files.map(async f => ({
        role: f.role,
        filename: f.filename,
        url: await presignPutUrl(f.key, f.contentType),
      }))
    );

// 8) Return response
  return {
    statusCode: 201,
    body: JSON.stringify({
      announcementId,
      createdAt,
      uploadUrls,
    }),
  };

  } catch (err: any) {
    console.error("Error in createAnnouncementHandler:", err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err.message })
    };
  }
};
