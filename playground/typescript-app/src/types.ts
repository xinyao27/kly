// Shared type definitions for the application

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type UserId = string;
export type Email = string;
export type HashedPassword = string;

export enum UserRole {
  Admin = "admin",
  Member = "member",
  Guest = "guest",
}

export enum AuthErrorCode {
  InvalidCredentials = "INVALID_CREDENTIALS",
  TokenExpired = "TOKEN_EXPIRED",
  Unauthorized = "UNAUTHORIZED",
}
