// Database access layer with async query functions

import type { User, UserId, Email } from "./types";
import { UserRole } from "./types";

export type QueryResult<T> = { data: T; count: number };

const users: User[] = [
  {
    id: "1",
    email: "admin@example.com",
    name: "Admin",
    role: UserRole.Admin,
    createdAt: new Date("2024-01-01"),
  },
];

export async function findUserByEmail(email: Email): Promise<User | undefined> {
  return users.find((u) => u.email === email);
}

export async function findUserById(id: UserId): Promise<User | undefined> {
  return users.find((u) => u.id === id);
}

export async function listUsers(limit: number = 10): Promise<QueryResult<User[]>> {
  const result = users.slice(0, limit);
  return { data: result, count: result.length };
}

export async function createUser(email: Email, name: string, role: UserRole): Promise<User> {
  const user: User = {
    id: String(users.length + 1),
    email,
    name,
    role,
    createdAt: new Date(),
  };
  users.push(user);
  return user;
}
