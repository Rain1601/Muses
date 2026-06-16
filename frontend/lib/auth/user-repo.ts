import { eq } from 'drizzle-orm';
import { db, users, userSettings, type User } from '@/lib/db';
import { encrypt } from '@/lib/crypto';

export interface OAuthProfile {
  githubId?: string;
  googleId?: string;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  /** Raw OAuth access token to encrypt and persist as githubToken (GitHub only). */
  githubAccessToken?: string;
}

export interface UpsertResult {
  user: User;
  isNewUser: boolean;
}

async function ensureSettings(userId: string): Promise<void> {
  await db
    .insert(userSettings)
    .values({ userId })
    .onConflictDoNothing({ target: userSettings.userId });
}

export async function upsertFromGitHub(profile: OAuthProfile): Promise<UpsertResult> {
  if (!profile.githubId) throw new Error('upsertFromGitHub requires githubId');

  const [existing] = await db.select().from(users).where(eq(users.githubId, profile.githubId)).limit(1);
  const encryptedToken = profile.githubAccessToken ? encrypt(profile.githubAccessToken) : null;

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        username: profile.username,
        email: profile.email ?? null,
        avatarUrl: profile.avatarUrl ?? null,
        ...(encryptedToken !== null ? { githubToken: encryptedToken } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return { user: updated, isNewUser: false };
  }

  const [created] = await db
    .insert(users)
    .values({
      githubId: profile.githubId,
      username: profile.username,
      email: profile.email ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      ...(encryptedToken !== null ? { githubToken: encryptedToken } : {}),
    })
    .returning();
  await ensureSettings(created.id);
  return { user: created, isNewUser: true };
}

export async function upsertFromGoogle(profile: OAuthProfile): Promise<UpsertResult> {
  if (!profile.googleId) throw new Error('upsertFromGoogle requires googleId');

  const [byGoogle] = await db.select().from(users).where(eq(users.googleId, profile.googleId)).limit(1);
  if (byGoogle) {
    const [updated] = await db
      .update(users)
      .set({
        username: profile.username || byGoogle.username,
        email: profile.email ?? null,
        avatarUrl: profile.avatarUrl ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, byGoogle.id))
      .returning();
    return { user: updated, isNewUser: false };
  }

  // Account merge: if a GitHub user already has this email, attach googleId to them
  if (profile.email) {
    const [byEmail] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
    if (byEmail) {
      const [merged] = await db
        .update(users)
        .set({
          googleId: profile.googleId,
          avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl ?? null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, byEmail.id))
        .returning();
      return { user: merged, isNewUser: false };
    }
  }

  const [created] = await db
    .insert(users)
    .values({
      googleId: profile.googleId,
      username: profile.username,
      email: profile.email ?? null,
      avatarUrl: profile.avatarUrl ?? null,
    })
    .returning();
  await ensureSettings(created.id);
  return { user: created, isNewUser: true };
}
