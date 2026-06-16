import { boolean, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';

const uuid = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID());

const createdAt = timestamp('createdAt', { mode: 'date', withTimezone: false }).defaultNow().notNull();
const updatedAt = timestamp('updatedAt', { mode: 'date', withTimezone: false }).defaultNow().notNull();

export const users = pgTable(
  'User',
  {
    id: uuid(),
    githubId: text('githubId'),
    googleId: text('googleId'),
    username: text('username').notNull(),
    email: text('email'),
    avatarUrl: text('avatarUrl'),
    // Aggregated AI provider keys (AES-GCM encrypted via lib/crypto.ts)
    aihubmixKey: text('aihubmixKey'),
    openrouterKey: text('openrouterKey'),
    bailianKey: text('bailianKey'),
    // Legacy keys, kept for backward compat during migration
    openaiKey: text('openaiKey'),
    claudeKey: text('claudeKey'),
    geminiKey: text('geminiKey'),
    githubToken: text('githubToken'),
    defaultRepoUrl: text('defaultRepoUrl'),
    createdAt,
    updatedAt,
  },
  (t) => ({
    githubIdUnique: uniqueIndex('User_githubId_unique').on(t.githubId),
    googleIdUnique: uniqueIndex('User_googleId_unique').on(t.googleId),
  }),
);

export const userSettings = pgTable('UserSettings', {
  id: uuid(),
  userId: text('userId')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  language: text('language').default('zh-CN'),
  theme: text('theme').default('light'),
  autoSave: boolean('autoSave').default(true),
  createdAt,
  updatedAt,
});

export const agents = pgTable('Agent', {
  id: uuid(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  avatar: text('avatar'),
  language: text('language').default('zh-CN'),
  tone: text('tone').default('professional'),
  lengthPreference: text('lengthPreference').default('medium'),
  targetAudience: text('targetAudience'),
  customPrompt: text('customPrompt'),
  outputFormat: text('outputFormat').default('markdown'),
  specialRules: text('specialRules'),
  isDefault: boolean('isDefault').default(false),
  createdAt,
  updatedAt,
});

export const articles = pgTable('Article', {
  id: uuid(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  agentId: text('agentId')
    .notNull()
    .references(() => agents.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  summary: text('summary'),
  // Publish state
  publishStatus: text('publishStatus').default('draft'),
  publishedAt: timestamp('publishedAt', { mode: 'date', withTimezone: false }),
  githubUrl: text('githubUrl'),
  repoPath: text('repoPath'),
  // Sync state
  syncStatus: text('syncStatus').default('local'),
  firstSyncAt: timestamp('firstSyncAt', { mode: 'date', withTimezone: false }),
  lastSyncAt: timestamp('lastSyncAt', { mode: 'date', withTimezone: false }),
  syncCount: text('syncCount').default('0'),
  githubSha: text('githubSha'),
  localModifiedAt: timestamp('localModifiedAt', { mode: 'date', withTimezone: false }),
  githubModifiedAt: timestamp('githubModifiedAt', { mode: 'date', withTimezone: false }),
  // Metadata (JSON strings)
  sourceFiles: text('sourceFiles'),
  article_metadata: text('article_metadata'),
  createdAt,
  updatedAt,
});

export const skills = pgTable('Skill', {
  id: uuid(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  category: text('category').default('general'),
  prompt: text('prompt').notNull(),
  isPreset: boolean('isPreset').default(false),
  createdAt,
  updatedAt,
});

export const syncHistory = pgTable('SyncHistory', {
  id: uuid(),
  articleId: text('articleId')
    .notNull()
    .references(() => articles.id, { onDelete: 'cascade' }),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  syncType: text('syncType').notNull(),
  syncDirection: text('syncDirection').notNull(),
  syncStatus: text('syncStatus').notNull(),
  contentBefore: text('contentBefore'),
  contentAfter: text('contentAfter'),
  hasChanges: text('hasChanges').default('false'),
  githubSha: text('githubSha'),
  githubUrl: text('githubUrl'),
  repoPath: text('repoPath'),
  conflictType: text('conflictType'),
  conflictResolution: text('conflictResolution'),
  errorMessage: text('errorMessage'),
  syncDuration: integer('syncDuration'),
  fileSize: integer('fileSize'),
  createdAt,
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSettingsRow = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type SyncHistoryRow = typeof syncHistory.$inferSelect;
export type NewSyncHistory = typeof syncHistory.$inferInsert;
