import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User } from '@prisma/client';
import { UserRepository } from '../repositories/user.repository';
import { RefreshTokenRepository } from '../repositories/refreshToken.repository';
import { AuditRepository } from '../repositories/audit.repository';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { logAuth } from '../config/logger';
import { JwtAccessPayload, JwtRefreshPayload } from '../types';
import { RegisterInput, LoginInput } from '../validators/auth.validator';

export class AuthService {
  private userRepo = new UserRepository();
  private tokenRepo = new RefreshTokenRepository();
  private auditRepo = new AuditRepository();

  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: env.ARGON2_MEMORY_COST,
      timeCost: env.ARGON2_TIME_COST,
      parallelism: env.ARGON2_PARALLELISM,
    });
  }

  private async verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  private generateAccessToken(user: User): string {
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  private generateRefreshToken(userId: string, tokenId: string): string {
    const payload: JwtRefreshPayload = {
      sub: userId,
      tokenId,
    };
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  private getRefreshTokenExpiry(): Date {
    const ms = env.JWT_REFRESH_EXPIRES_IN.includes('d')
      ? parseInt(env.JWT_REFRESH_EXPIRES_IN) * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms);
  }

  async register(
    input: RegisterInput,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw AppError.conflict('Email já cadastrado');
    }

    const passwordHash = await this.hashPassword(input.password);

    const user = await this.userRepo.create({
      name: input.name,
      email: input.email,
      passwordHash,
      phone: input.phone,
    });

    await this.auditRepo.create({
      actorId: user.id,
      userId: user.id,
      action: 'REGISTER',
      resource: 'User',
      resourceId: user.id,
      ipAddress,
      userAgent,
    });

    logAuth('REGISTER', user.id, { email: user.email, ip: ipAddress });

    const accessToken = this.generateAccessToken(user);
    const tokenId = uuidv4();
    const refreshTokenStr = this.generateRefreshToken(user.id, tokenId);

    await this.tokenRepo.create({
      token: refreshTokenStr,
      userId: user.id,
      expiresAt: this.getRefreshTokenExpiry(),
      ipAddress,
      userAgent,
    });

    const { passwordHash: _, ...userSafe } = user;

    return { user: userSafe, accessToken, refreshToken: refreshTokenStr };
  }

  async login(
    input: LoginInput,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.userRepo.findByEmail(input.email);

    // Verificação em tempo constante — não revelar se usuário existe
    if (!user) {
      await argon2.hash('dummy_password_prevent_timing_attack');
      throw AppError.unauthorized('Email ou senha inválidos');
    }

    if (!user.isActive || user.deletedAt) {
      throw AppError.unauthorized('Conta desativada');
    }

    const passwordValid = await this.verifyPassword(user.passwordHash, input.password);
    if (!passwordValid) {
      await this.auditRepo.create({
        actorId: user.id,
        userId: user.id,
        action: 'LOGIN',
        resource: 'User',
        resourceId: user.id,
        ipAddress,
        userAgent,
        metadata: { success: false, reason: 'invalid_password' },
      });
      logAuth('LOGIN_FAILED', user.id, { ip: ipAddress });
      throw AppError.unauthorized('Email ou senha inválidos');
    }

    const accessToken = this.generateAccessToken(user);
    const tokenId = uuidv4();
    const refreshTokenStr = this.generateRefreshToken(user.id, tokenId);

    await this.tokenRepo.create({
      token: refreshTokenStr,
      userId: user.id,
      expiresAt: this.getRefreshTokenExpiry(),
      ipAddress,
      userAgent,
    });

    await this.auditRepo.create({
      actorId: user.id,
      userId: user.id,
      action: 'LOGIN',
      resource: 'User',
      resourceId: user.id,
      ipAddress,
      userAgent,
      metadata: { success: true },
    });

    logAuth('LOGIN_SUCCESS', user.id, { email: user.email, ip: ipAddress });

    const { passwordHash: _, ...userSafe } = user;
    return { user: userSafe, accessToken, refreshToken: refreshTokenStr };
  }

  async refreshTokens(
    refreshTokenStr: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Verifica JWT
    let payload: JwtRefreshPayload;
    try {
      payload = jwt.verify(refreshTokenStr, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
    } catch {
      throw AppError.unauthorized('Refresh token inválido ou expirado');
    }

    // Busca no banco
    const storedToken = await this.tokenRepo.findByToken(refreshTokenStr);
    if (!storedToken) {
      throw AppError.unauthorized('Refresh token não encontrado ou revogado');
    }

    if (storedToken.expiresAt < new Date()) {
      await this.tokenRepo.revoke(storedToken.id);
      throw AppError.unauthorized('Refresh token expirado');
    }

    // Revoga o token atual (rotação)
    await this.tokenRepo.revoke(storedToken.id);

    const user = await this.userRepo.findById(payload.sub);
    if (!user || !user.isActive) {
      throw AppError.unauthorized('Usuário não encontrado ou inativo');
    }

    // Emite novos tokens
    const accessToken = this.generateAccessToken(user);
    const newTokenId = uuidv4();
    const newRefreshToken = this.generateRefreshToken(user.id, newTokenId);

    await this.tokenRepo.create({
      token: newRefreshToken,
      userId: user.id,
      expiresAt: this.getRefreshTokenExpiry(),
      ipAddress,
      userAgent,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string, refreshTokenStr?: string): Promise<void> {
    if (refreshTokenStr) {
      const stored = await this.tokenRepo.findByToken(refreshTokenStr);
      if (stored) {
        await this.tokenRepo.revoke(stored.id);
      }
    } else {
      await this.tokenRepo.revokeAllByUserId(userId);
    }

    await this.auditRepo.create({
      actorId: userId,
      userId,
      action: 'LOGOUT',
      resource: 'User',
      resourceId: userId,
    });

    logAuth('LOGOUT', userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw AppError.notFound('Usuário não encontrado');

    const valid = await this.verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      throw AppError.badRequest('Senha atual incorreta');
    }

    const newHash = await this.hashPassword(newPassword);
    await this.userRepo.update(userId, { passwordHash: newHash });
    await this.tokenRepo.revokeAllByUserId(userId);

    await this.auditRepo.create({
      actorId: userId,
      userId,
      action: 'PASSWORD_CHANGE',
      resource: 'User',
      resourceId: userId,
    });

    logAuth('PASSWORD_CHANGED', userId);
  }
}