import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const tasks = sqliteTable('tasks', {
  // id is set on insert, incrementing
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),

  /* core */
  title: text('title', { length: 256 }).notNull(),
  description: text('description', { length: 512 }).notNull(),

  /* scheduling */
  dueAt: integer('due_at'),          // ms epoch, nullable
  scheduledFor: integer('scheduled_for'),   // ms epoch, nullable
  repeatRule: text('repeat_rule'),        // RFC 5545 RRULE

  /* state */
  status: text('status', {
    enum: ['pending', 'active', 'blocked', 'done', 'archived'],
  }).default('pending').notNull(),
  completedAt: integer('completed_at'),

  /* difficulty / priority */
  priority: integer('priority').default(3),   // 1‑5
  difficulty: integer('difficulty').default(3), // 1‑5

  /* gamification */
  xpReward: integer('xp_reward').default(0),
  goldReward: integer('gold_reward').default(0),
  energyCost: integer('energy_cost').default(0),

  /* relations */
  parentId: integer('parent_id').references(() => tasks.id),

  /* metadata */
  tags: text('tags'),              // JSON string
  notes: text('notes'),

  /* audit */
  createdAt: integer('created_at').notNull().default(sql`unixepoch('now') * 1000`),
  updatedAt: integer('updated_at').notNull().default(sql`unixepoch('now') * 1000`),
});
