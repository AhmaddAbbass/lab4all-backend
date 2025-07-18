import { randomUUID } from "crypto";

export function newClassroomId() {
  return randomUUID();
}

// 6-char uppercase alphanumeric skipping ambiguous chars
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newJoinCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}
