import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { Membership } from "../models";

const MEMBERS_FILE = path.join(__dirname, "..", "..", "data", "memberships.json");

function load(): Membership[] {
  if (!existsSync(MEMBERS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(MEMBERS_FILE, "utf-8")) as Membership[];
  } catch {
    return [];
  }
}

function save(all: Membership[]) {
  writeFileSync(MEMBERS_FILE, JSON.stringify(all, null, 2), "utf-8");
}

export const membershipRepo = {
  find(studentId: string, classroomId: string): Membership | undefined {
    return load().find(m => m.studentId === studentId && m.classroomId === classroomId);
  },

  create(studentId: string, classroomId: string): Membership {
    const all = load();
    const existing = all.find(m => m.studentId === studentId && m.classroomId === classroomId);
    if (existing) return existing; // idempotent
    const membership: Membership = {
      studentId,
      classroomId,
      joinedAt: new Date().toISOString()
    };
    all.push(membership);
    save(all);
    return membership;
  },
  listByStudent(studentId: string) {
  const all = load();
  return all.filter(m => m.studentId === studentId);
}
};
