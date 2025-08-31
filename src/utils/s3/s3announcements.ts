// src/utils/s3/s3announcements.ts  (AWS SDK v2)

import AWS from "aws-sdk";

const s3 = new AWS.S3();
const bucket = process.env.ANNOUNCEMENTS_BUCKET!;
const ttl    = Number(process.env.SIGNED_URL_TTL ?? "600");

export interface FileMeta {
  key: string;
  filename: string;
  contentType: string;
  role: "body" | "attachment";
}

/** Presign a single GET url */
export function presignGetUrl(key: string) {
  return s3.getSignedUrl("getObject", { Bucket: bucket, Key: key, Expires: ttl });
}

/** Presign PUT url for uploads */
export function presignPutUrl(key: string, contentType: string) {
  return s3.getSignedUrl("putObject", {
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    Expires: ttl,
  });
}

export { s3 };   // if some code still needs the raw client
