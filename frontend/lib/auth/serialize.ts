import type { User } from '@/lib/db';

export interface SerializedUser {
  id: string;
  githubId: string | null;
  googleId: string | null;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  hasAihubmixKey: boolean;
  hasOpenrouterKey: boolean;
  hasBailianKey: boolean;
  hasOpenAIKey: boolean;
  hasClaudeKey: boolean;
  hasGeminiKey: boolean;
  hasGitHubToken: boolean;
  defaultRepoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export function serializeUser(user: User): SerializedUser {
  return {
    id: user.id,
    githubId: user.githubId,
    googleId: user.googleId,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    hasAihubmixKey: Boolean(user.aihubmixKey),
    hasOpenrouterKey: Boolean(user.openrouterKey),
    hasBailianKey: Boolean(user.bailianKey),
    hasOpenAIKey: Boolean(user.openaiKey),
    hasClaudeKey: Boolean(user.claudeKey),
    hasGeminiKey: Boolean(user.geminiKey),
    hasGitHubToken: Boolean(user.githubToken),
    defaultRepoUrl: user.defaultRepoUrl,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
