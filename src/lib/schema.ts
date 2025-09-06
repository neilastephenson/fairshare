import { pgTable, text, timestamp, boolean, numeric, uuid, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified"),
  image: text("image"),
  paymentInfo: text("paymentInfo"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// FayrShare specific tables

export const group = pgTable("group", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  currency: text("currency").notNull().default("GBP"), // USD, GBP, EUR, or OTHER
  inviteCode: text("inviteCode").notNull().unique(),
  createdBy: text("createdBy")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (table) => {
  return {
    inviteCodeIdx: index("group_invite_code_idx").on(table.inviteCode),
  };
});

export const groupMember = pgTable("groupMember", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("groupId")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // 'admin' or 'member'
  joinedAt: timestamp("joinedAt").notNull().defaultNow(),
}, (table) => {
  return {
    groupUserIdx: index("group_member_group_user_idx").on(table.groupId, table.userId),
  };
});

export const expense = pgTable("expense", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("groupId")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" }),
  paidBy: text("paidBy")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  category: text("category"),
  date: timestamp("date").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (table) => {
  return {
    groupIdx: index("expense_group_idx").on(table.groupId),
    paidByIdx: index("expense_paid_by_idx").on(table.paidBy),
  };
});

export const expenseParticipant = pgTable("expenseParticipant", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseId: uuid("expenseId")
    .notNull()
    .references(() => expense.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  shareAmount: numeric("shareAmount", { precision: 12, scale: 2 }).notNull(),
}, (table) => {
  return {
    expenseUserIdx: index("expense_participant_expense_user_idx").on(table.expenseId, table.userId),
  };
});

export const activityLog = pgTable("activityLog", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("groupId")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  action: text("action").notNull(), // 'expense_added', 'expense_edited', 'expense_deleted', 'member_joined', 'member_left'
  entityType: text("entityType"), // 'expense', 'member'
  entityId: text("entityId"), // ID of the affected entity
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => {
  return {
    groupIdx: index("activity_log_group_idx").on(table.groupId),
  };
});
