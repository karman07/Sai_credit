import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { User } from '../users/schemas/user.schema';
import { Session } from './schemas/session.schema';
import {
  Portal,
  UserRole,
  ADMIN_PORTAL_ROLES,
  isSalesRole,
  AuditAction,
} from '../common/enums';
import { AuditService } from '../common/audit/audit.service';
import { AttendanceService } from '../attendance/attendance.service';
import { AuthUser } from '../common/types';
import { LoginDto } from './auth.dto';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Session.name) private readonly sessions: Model<Session>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly attendance: AttendanceService,
  ) {}

  // ── Login ──────────────────────────────────────────────────────────
  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.users
      .findOne({ email: dto.email.toLowerCase() })
      .select('+passwordHash')
      .lean();

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }
    this.assertPortalAccess(user.role, dto.portal);

    const authUser = this.toAuthUser(user, dto.portal);
    const tokens = await this.issueTokens(authUser, dto.portal, ip, userAgent);

    await this.users.updateOne({ _id: user._id }, { lastLoginAt: new Date() });
    await this.audit.log({
      user: authUser,
      action: AuditAction.Login,
      entityType: 'user',
      entityId: user._id,
      ip,
      userAgent,
    });

    // Auto clock-in for sales roles
    if (isSalesRole(user.role)) {
      this.attendance.autoClockIn(String(user._id), ip).catch(() => {/* non-fatal */});
    }

    return { user: authUser, ...tokens };
  }

  // ── Refresh (with rotation) ─────────────────────────────────────────
  async refresh(refreshToken: string, ip?: string, userAgent?: string) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = sha256(refreshToken);
    const session = await this.sessions.findOne({ tokenHash });
    if (!session) throw new UnauthorizedException('Session expired or revoked');

    // rotate: delete the old session, issue a fresh pair
    await this.sessions.deleteOne({ _id: session._id });

    const user = await this.users.findById(payload.sub).lean();
    if (!user || !user.isActive) throw new UnauthorizedException('User unavailable');

    const portal = session.portal;
    const authUser = this.toAuthUser(user, portal);
    const tokens = await this.issueTokens(authUser, portal, ip, userAgent);
    return { user: authUser, ...tokens };
  }

  // ── Logout ──────────────────────────────────────────────────────────
  async logout(refreshToken: string, user?: AuthUser) {
    if (refreshToken) {
      await this.sessions.deleteOne({ tokenHash: sha256(refreshToken) });
    }
    if (user) {
      await this.audit.log({ user, action: AuditAction.Logout, entityType: 'user', entityId: user.id });

      // Auto clock-out for sales roles on logout
      if (isSalesRole(user.role as UserRole)) {
        this.attendance.autoClockOut(user.id).catch(() => {/* non-fatal */});
      }
    }
    return { ok: true };
  }

  // ── Forgot password ─────────────────────────────────────────────────
  async forgotPassword(email: string) {
    const user = await this.users.findOne({ email: email.toLowerCase() });
    // Always return ok (don't leak which emails exist).
    if (user) {
      const raw = randomBytes(32).toString('hex');
      user.set('pwdResetTokenHash', sha256(raw));
      user.set('pwdResetExpiresAt', new Date(Date.now() + 60 * 60 * 1000)); // 1h
      await user.save();
      // TODO: send `raw` token via email (Resend). Logged for dev convenience.
      // eslint-disable-next-line no-console
      console.log(`[DEV] Password reset token for ${email}: ${raw}`);
    }
    return { ok: true };
  }

  // ── Reset password ──────────────────────────────────────────────────
  async resetPassword(token: string, password: string) {
    const user = await this.users
      .findOne({ pwdResetTokenHash: sha256(token) })
      .select('+pwdResetExpiresAt');
    const expiresAt: Date | undefined = user?.get('pwdResetExpiresAt');
    if (!user || !expiresAt || expiresAt < new Date()) {
      throw new UnauthorizedException('Reset link is invalid or expired');
    }
    user.set('passwordHash', await bcrypt.hash(password, 12));
    user.set('pwdResetTokenHash', undefined);
    user.set('pwdResetExpiresAt', undefined);
    await user.save();
    // invalidate all sessions for safety
    await this.sessions.deleteMany({ userId: user._id });
    return { ok: true };
  }

  // ── Helpers ─────────────────────────────────────────────────────────
  private assertPortalAccess(role: UserRole, portal: Portal) {
    const allowed =
      portal === Portal.Admin ? ADMIN_PORTAL_ROLES.includes(role) : isSalesRole(role);
    if (!allowed) {
      throw new ForbiddenException(`Your role cannot access the ${portal} portal`);
    }
  }

  private toAuthUser(user: any, portal: Portal): AuthUser {
    return {
      id: String(user._id),
      email: user.email,
      role: user.role,
      portal,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  private async issueTokens(user: AuthUser, portal: Portal, ip?: string, userAgent?: string) {
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        portal,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessTtl') as any,
      },
    );

    const days = this.config.get<number>('jwt.refreshTtlDays')!;
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: randomBytes(16).toString('hex') },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: `${days}d` as any,
      },
    );

    // Enforce max active sessions per user (oldest evicted).
    const max = this.config.get<number>('jwt.maxSessions')!;
    const existing = await this.sessions
      .find({ userId: new Types.ObjectId(user.id) })
      .sort({ createdAt: 1 });
    if (existing.length >= max) {
      const toRemove = existing.slice(0, existing.length - max + 1);
      await this.sessions.deleteMany({ _id: { $in: toRemove.map((s) => s._id) } });
    }

    await this.sessions.create({
      userId: new Types.ObjectId(user.id),
      tokenHash: sha256(refreshToken),
      ipAddress: ip,
      userAgent,
      portal,
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    });

    return { accessToken, refreshToken };
  }
}
