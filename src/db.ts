import { readFileSync, writeFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { USERS_FILE } from "./config";
import { User } from "./models";

function loadUsers(): User[] {
  try {
    if (!existsSync(USERS_FILE)) return [];
    const raw = readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(raw) as User[];
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

export const userRepo = {
  findByEmail(email: string): User | undefined {
    const users = loadUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },
  create(email: string, passwordHash: string, role: "student" | "instructor"): User {
    const users = loadUsers();
    const user: User = {
      id: randomUUID(),
      email,
      passwordHash,
      role,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);
    return user;
  }
};
