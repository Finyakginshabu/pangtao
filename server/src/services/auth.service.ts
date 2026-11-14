import { prisma } from '../prisma.js';
import {
  comparePassword,
  dummyBcryptCompare,
  generateSessionToken,
  hashSessionToken,
} from '../utils/hash.util.js';
import { loginAttemptService } from './login-attempt.service.js';
import { AppError } from '../middleware/error.middleware.js';
import { LoginDto } from '../schemas/auth.schema.js';

const SESSION_TTL_HOURS = parseInt(process.env.SESSION_TTL_HOURS || '8', 10);

export class AuthService {
  async login(ip: string, dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Timing attack mitigation: if user does not exist or is inactive, perform dummy comparison
    if (!user || !user.isActive) {
      await dummyBcryptCompare(dto.password);
      await loginAttemptService.recordFailure(ip, normalizedEmail);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const isMatch = await comparePassword(dto.password, user.passwordHash);
    if (!isMatch) {
      await loginAttemptService.recordFailure(ip, normalizedEmail);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Login successful: reset rate limiter for this IP & email
    await loginAttemptService.reset(ip, normalizedEmail);

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      token,
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
    };
  }

  async logout(rawToken?: string) {
    if (!rawToken || typeof rawToken !== 'string') {
      return;
    }

    const tokenHash = hashSessionToken(rawToken);
    await prisma.session.deleteMany({
      where: { tokenHash },
    });
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    return user;
  }
}

export const authService = new AuthService();

