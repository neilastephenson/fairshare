import { pgTable, text, timestamp, boolean, numeric, uuid, index, integer } from "drizzle-orm/pg-core";

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
  role: text("role").notNull().default("member"), // Keep existing role column
  joinedAt: timestamp("joinedAt").notNull().defaultNow(),
}, (table) => {
  return {
    groupUserIdx: index("group_member_group_user_idx").on(table.groupId, table.userId),
  };
});

export const placeholderUser = pgTable("placeholderUser", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("groupId")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdBy: text("createdBy")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  claimedBy: text("claimedBy")
    .references(() => user.id, { onDelete: "set null" }),
  claimedAt: timestamp("claimedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => {
  return {
    groupIdx: index("placeholder_user_group_idx").on(table.groupId),
    claimedByIdx: index("placeholder_user_claimed_by_idx").on(table.claimedBy),
  };
});

export const expense = pgTable("expense", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("groupId")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" }),
  paidBy: text("paidBy").notNull(), // Can be user ID or placeholder ID
  paidByType: text("paidByType").notNull().default("user"), // 'user' or 'placeholder'
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
  userId: text("userId").notNull(), // Can be user ID or placeholder ID
  userType: text("userType").notNull().default("user"), // 'user' or 'placeholder'
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

// Receipt processing tables
export const receiptSession = pgTable("receiptSession", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("groupId")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" }),
  createdBy: text("createdBy")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  merchantName: text("merchantName"),
  receiptDate: timestamp("receiptDate"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("taxAmount", { precision: 12, scale: 2 }).notNull().default("0"),
  tipAmount: numeric("tipAmount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("totalAmount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("processing"), // 'processing', 'claiming', 'completed', 'cancelled'
  participants: text("participants"), // JSON array of participant objects
  expiresAt: timestamp("expiresAt").notNull(),
  expenseId: uuid("expenseId").references(() => expense.id), // Link to final expense
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (table) => {
  return {
    groupIdx: index("receipt_session_group_idx").on(table.groupId),
    statusIdx: index("receipt_session_status_idx").on(table.status),
    expiresAtIdx: index("receipt_session_expires_at_idx").on(table.expiresAt),
  };
});

export const receiptItem = pgTable("receiptItem", {
  id: uuid("id").primaryKey().defaultRandom(),
  receiptSessionId: uuid("receiptSessionId")
    .notNull()
    .references(() => receiptSession.id, { onDelete: "cascade" }),
  itemName: text("itemName").notNull(),
  itemPrice: numeric("itemPrice", { precision: 12, scale: 2 }).notNull(),
  orderIndex: integer("orderIndex").notNull(), // preserve order from receipt
  isSplitItem: boolean("isSplitItem").notNull().default(false), // true for virtual split items
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => {
  return {
    sessionIdx: index("receipt_item_session_idx").on(table.receiptSessionId),
  };
});

export const receiptItemClaim = pgTable("receiptItemClaim", {
  id: uuid("id").primaryKey().defaultRandom(),
  receiptItemId: uuid("receiptItemId")
    .notNull()
    .references(() => receiptItem.id, { onDelete: "cascade" }),
  userId: text("userId").notNull(), // Can be user ID or placeholder ID
  userType: text("userType").notNull().default("user"), // 'user' or 'placeholder'
  claimedAt: timestamp("claimedAt").notNull().defaultNow(),
}, (table) => {
  return {
    itemIdx: index("receipt_item_claim_item_idx").on(table.receiptItemId),
    userIdx: index("receipt_item_claim_user_idx").on(table.userId),
  };
});
