import { Prisma, Role } from '@prisma/client';
import { prisma } from '../prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import type { ListUsersQueryDto } from '../schemas/admin.schema.js';

/**
 * BR-02 (Admin Isolation): only non-financial profile metadata is ever selected.
 * Never add password hashes, balances, accounts or transactions to this shape.
 */
const USER_PROFILE_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}

export class AdminService {
  /** AC-02.1: every user, ordered by display name, with profile fields only. */
  async listUsers(query: ListUsersQueryDto) {
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        select: USER_PROFILE_SELECT,
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        skip: query.offset,
        take: query.limit,
      }),
      prisma.user.count(),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  /**
   * AC-02.3..02.6, 02.9 / BR-03, BR-13.
   * Deactivation updates `users.is_active` and deletes every session for the target
   * in the same transaction, so no partially-revoked state can survive.
   */
  async updateUserStatus(
    targetUserId: string,
    isActive: boolean,
    actorUserId: string
  ): Promise<UserProfile> {
    return prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
      });

      if (!target) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      // BR-03: an Administrator can never disable their own account.
      if (!isActive && targetUserId === actorUserId) {
        throw new AppError(409, 'CANNOT_DISABLE_SELF', 'You cannot disable your own account');
      }

      const user = await tx.user.update({
        where: { id: targetUserId },
        data: { isActive },
        select: USER_PROFILE_SELECT,
      });

      // BR-13: purge all sessions of the disabled user within the same transaction.
      if (!isActive) {
        await tx.session.deleteMany({ where: { userId: targetUserId } });
      }

      return user;
    });
  }
}

export const adminService = new AdminService();
