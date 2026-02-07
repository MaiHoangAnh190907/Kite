import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import speakeasy from 'speakeasy';
import { db } from '../db/connection.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error-handler.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import type { JwtPayload } from '../middleware/auth.js';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const TEMP_TOKEN_EXPIRY = '5m';
const TABLET_TOKEN_EXPIRY = '12h';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<{ mfaRequired: boolean; tempToken: string }> {
  const user = await db('users').where({ email, is_active: true }).first();
  if (!user || !user.password_hash) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid credentials');
  }

  const payload: JwtPayload = {
    sub: user.id,
    clinicId: user.clinic_id,
    role: user.role,
    type: 'temp',
  };

  const tempToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: TEMP_TOKEN_EXPIRY });

  return { mfaRequired: user.mfa_enabled, tempToken };
}

export async function verifyMfa(
  tempToken: string,
  totpCode: string,
): Promise<{ accessToken: string; refreshToken: string; user: { id: string; name: string; role: string; clinicId: string } }> {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(tempToken, env.JWT_SECRET) as JwtPayload;
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired temp token');
  }

  if (payload.type !== 'temp') {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid token type');
  }

  const user = await db('users').where({ id: payload.sub, is_active: true }).first();
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'User not found');
  }

  // If MFA is enabled, verify TOTP
  if (user.mfa_enabled && user.mfa_secret_encrypted) {
    const secret = decrypt(user.mfa_secret_encrypted);
    const valid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: totpCode,
      window: 1,
    });
    if (!valid) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid MFA code');
    }
  }
  // For dev users without MFA, accept code "000000"
  else if (totpCode !== '000000') {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid MFA code');
  }

  const accessPayload: JwtPayload = {
    sub: user.id,
    clinicId: user.clinic_id,
    role: user.role,
    type: 'access',
    mfaVerified: true,
  };

  const accessToken = jwt.sign(accessPayload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = await createRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, role: user.role, clinicId: user.clinic_id },
  };
}

export async function setupMfa(
  userId: string,
): Promise<{ secret: string; qrCodeUrl: string }> {
  const user = await db('users').where({ id: userId }).first();
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  const secret = speakeasy.generateSecret({
    name: `Kite:${user.email}`,
    issuer: 'Kite Health',
  });

  const encryptedSecret = encrypt(secret.base32);
  await db('users').where({ id: userId }).update({
    mfa_secret_encrypted: encryptedSecret,
    mfa_enabled: true,
  });

  return {
    secret: secret.base32,
    qrCodeUrl: secret.otpauth_url ?? '',
  };
}

export async function verifyTabletPin(
  deviceToken: string,
  pin: string,
): Promise<{ accessToken: string; staffName: string; clinicName: string; staffUserId: string; tabletId: string }> {
  // Find the tablet by iterating and comparing device token hashes
  const tablets = await db('tablets').where({ is_active: true });
  let matchedTablet: typeof tablets[0] | undefined;

  for (const tablet of tablets) {
    const match = await bcrypt.compare(deviceToken, tablet.device_token_hash);
    if (match) {
      matchedTablet = tablet;
      break;
    }
  }

  if (!matchedTablet) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid device token');
  }

  // Find staff by PIN in the same clinic
  const staffUsers = await db('users').where({
    clinic_id: matchedTablet.clinic_id,
    role: 'staff',
    is_active: true,
  });

  let matchedStaff: typeof staffUsers[0] | undefined;
  for (const staff of staffUsers) {
    if (staff.pin_hash) {
      const match = await bcrypt.compare(pin, staff.pin_hash);
      if (match) {
        matchedStaff = staff;
        break;
      }
    }
  }

  if (!matchedStaff) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid PIN');
  }

  // Update tablet last seen
  await db('tablets').where({ id: matchedTablet.id }).update({ last_seen_at: new Date() });

  const clinic = await db('clinics').where({ id: matchedTablet.clinic_id }).first();

  const payload: JwtPayload = {
    sub: matchedStaff.id,
    clinicId: matchedTablet.clinic_id,
    role: 'staff',
    type: 'tablet',
  };

  const accessToken = jwt.sign(
    { ...payload, tabletId: matchedTablet.id },
    env.JWT_SECRET,
    { expiresIn: TABLET_TOKEN_EXPIRY },
  );

  return {
    accessToken,
    staffName: matchedStaff.name,
    clinicName: clinic?.name ?? 'Unknown',
    staffUserId: matchedStaff.id,
    tabletId: matchedTablet.id,
  };
}

export async function refreshTokens(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenHash = hashToken(refreshToken);
  const stored = await db('refresh_tokens')
    .where({ token_hash: tokenHash })
    .whereNull('revoked_at')
    .where('expires_at', '>', new Date())
    .first();

  if (!stored) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token');
  }

  // Revoke old token
  await db('refresh_tokens').where({ id: stored.id }).update({ revoked_at: new Date() });

  const user = await db('users').where({ id: stored.user_id, is_active: true }).first();
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'User not found');
  }

  const accessPayload: JwtPayload = {
    sub: user.id,
    clinicId: user.clinic_id,
    role: user.role,
    type: 'access',
    mfaVerified: true,
  };

  const newAccessToken = jwt.sign(accessPayload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const newRefreshToken = await createRefreshToken(user.id);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

async function createRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(48).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await db('refresh_tokens').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  return token;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}
