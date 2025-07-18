import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { Classroom } from "../models";
import { newClassroomId, newJoinCode } from "../util/id";

const CLASSROOM_FILE = path.join(__dirname, "..", "..", "data", "classrooms.json");

function load(): Classroom[] {
  if (!existsSync(CLASSROOM_FILE)) return [];
  try {
    return JSON.parse(readFileSync(CLASSROOM_FILE, "utf-8")) as Classroom[];
  } catch {
    return [];
  }
}

function save(all: Classroom[]) {
  writeFileSync(CLASSROOM_FILE, JSON.stringify(all, null, 2), "utf-8");
}

export const classroomRepo = {
  create(name: string, teacherId: string): Classroom {
    const all = load();
    let joinCode = newJoinCode();
    const codes = new Set(all.map(c => c.joinCode));
    while (codes.has(joinCode)) joinCode = newJoinCode();

    const classroom: Classroom = {
      classroomId: newClassroomId(),
      name,
      joinCode,
      teacherId,
      createdAt: new Date().toISOString()
    };
    all.push(classroom);
    save(all);
    return classroom;
  },

  findByJoinCode(code: string): Classroom | undefined {
    const all = load();
    return all.find(c => c.joinCode === code.toUpperCase());
  },

  // (Optional helper if needed later)
  findById(id: string): Classroom | undefined {
    const all = load();
    return all.find(c => c.classroomId === id);
  }
};
