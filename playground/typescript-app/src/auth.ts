// Authentication service with JWT token management

import type { User, AuthToken, AuthErrorCode } from "./types";
import { findUserByEmail, findUserById } from "./db";

export class AuthService {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  async login(email: string, password: string): Promise<AuthToken> {
    const user = await findUserByEmail(email);
    if (!user) {
      throw new Error("Invalid credentials");
    }
    return this.generateToken(user);
  }

  async verify(token: string): Promise<User> {
    const userId = this.decodeToken(token);
    const user = await findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  private generateToken(user: User): AuthToken {
    return {
      accessToken: `${user.id}.${this.secret}`,
      refreshToken: `refresh.${user.id}`,
      expiresIn: 3600,
    };
  }

  private decodeToken(token: string): string {
    return token.split(".")[0];
  }
}

export function authMiddleware(authService: AuthService) {
  return async (req: any, next: () => Promise<void>) => {
    const token = req.headers?.authorization?.replace("Bearer ", "");
    if (!token) {
      throw new Error("No token provided");
    }
    req.user = await authService.verify(token);
    return next();
  };
}
