// src/utils/s3/s3client.ts  (AWS SDK v2)

import AWS from "aws-sdk";

const s3 = new AWS.S3();
const bucket = process.env.EXPERIMENTS_BUCKET!;
const ttl    = Number(process.env.SIGNED_URL_TTL ?? "600");

export interface FileMeta {
  key: string;
  filename: string;
  contentType: string;
  role: "body" | "attachment";
}

/** Presign a single GET url */
export function presignGetUrlExp(key: string) {
  return s3.getSignedUrl("getObject", { Bucket: bucket, Key: key, Expires: ttl });
}

/** Presign PUT url for uploads */
export function presignPutUrlExp(key: string, contentType: string) {
  return s3.getSignedUrl("putObject", {
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    Expires: ttl,
  });
}

/**
 * Deletes the single linfo.txt file for an experiment.
 * The record.s3Key already stores the full path (…/linfo.txt).
 */
export async function deleteExperimentFile(bucket: string, key: string) {
  await s3.deleteObject({
    Bucket: bucket,
    Key: key,
  }).promise();
}

export { s3 };   // if some code still needs the raw client
