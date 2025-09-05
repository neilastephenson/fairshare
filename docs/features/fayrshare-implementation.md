# FayrShare Implementation Guide

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── groups/
│   │   │   ├── route.ts                 # Group CRUD operations
│   │   │   └── [id]/
│   │   │       ├── expenses/
│   │   │       │   └── [expenseId]/
│   │   │       │       └── route.ts     # Expense deletion
│   │   │       ├── members/
│   │   │       │   └── [userId]/
│   │   │       │       └── route.ts     # Member management
│   │   │       ├── balances/route.ts    # Balance calculations
│   │   │       ├── settlements/route.ts # Settlement optimization
│   │   │       ├── activity/route.ts    # Activity logging
│   │   │       └── invite/route.ts      # Invite management
│   │   └── invite/
│   │       └── [code]/route.ts          # Join via invite
│   ├── groups/
│   │   ├── page.tsx                     # Groups list
│   │   └── [id]/page.tsx               # Group details
│   └── invite/
│       └── [code]/page.tsx             # Invite landing
├── components/
│   ├── groups/
│   │   ├── group-list.tsx              # Groups display
│   │   ├── create-group-button.tsx     # Group creation
│   │   ├── expense-list.tsx            # Expense management
│   │   ├── add-expense-dialog.tsx      # Expense form
│   │   ├── member-list.tsx             # Member management
│   │   ├── balance-view.tsx            # Balance display
│   │   ├── settle-up-view.tsx          # Settlement plan
│   │   ├── activity-log.tsx            # Activity feed
│   │   ├── invite-section.tsx          # Invite links
│   │   └── join-group-form.tsx         # Join form
│   └── ui/                             # shadcn components
└── lib/
    ├── schema.ts                        # Database schema
    ├── db.ts                            # Database client
    └── auth.ts                          # Authentication

```

## Key Components

### 1. Group Management (`/groups/page.tsx`)
- Displays user's groups
- Create new group functionality
- Navigation to individual groups

### 2. Group Details (`/groups/[id]/page.tsx`)
- Tabbed interface for different features
- Role-based UI (admin vs member)
- Real-time data display

### 3. Expense Tracking (`expense-list.tsx`)
- List/add/delete expenses
- Participant management
- Category organization

### 4. Balance Calculation (`balance-view.tsx`)
```typescript
// Core balance calculation logic
function calculateBalances(expenses, members) {
  const balances = {};
  
  // Initialize balances
  members.forEach(member => {
    balances[member.id] = {
      paid: 0,
      share: 0,
      balance: 0
    };
  });
  
  // Calculate paid and share amounts
  expenses.forEach(expense => {
    balances[expense.paidBy].paid += expense.amount;
    expense.participants.forEach(p => {
      balances[p.userId].share += p.shareAmount;
    });
  });
  
  // Calculate net balance
  Object.keys(balances).forEach(userId => {
    balances[userId].balance = 
      balances[userId].paid - balances[userId].share;
  });
  
  return balances;
}
```

### 5. Settlement Optimization (`settle-up-view.tsx`)
```typescript
// Minimal transaction algorithm
function calculateSettlements(balances) {
  const debtors = [];
  const creditors = [];
  
  // Separate debtors and creditors
  Object.entries(balances).forEach(([userId, data]) => {
    if (data.balance < 0) {
      debtors.push({ userId, amount: Math.abs(data.balance) });
    } else if (data.balance > 0) {
      creditors.push({ userId, amount: data.balance });
    }
  });
  
  // Sort by amount
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);
  
  const settlements = [];
  
  // Match debtors with creditors
  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = debtors[0];
    const creditor = creditors[0];
    
    const amount = Math.min(debtor.amount, creditor.amount);
    
    settlements.push({
      from: debtor.userId,
      to: creditor.userId,
      amount
    });
    
    debtor.amount -= amount;
    creditor.amount -= amount;
    
    if (debtor.amount === 0) debtors.shift();
    if (creditor.amount === 0) creditors.shift();
  }
  
  return settlements;
}
```

## Database Operations

### Creating a Group
```typescript
// 1. Generate unique invite code
const inviteCode = nanoid(10);

// 2. Insert group record
const group = await db.insert(groupTable).values({
  name,
  description,
  inviteCode,
  createdBy: userId
}).returning();

// 3. Add creator as admin
await db.insert(groupMember).values({
  groupId: group.id,
  userId,
  role: 'admin'
});

// 4. Log activity
await db.insert(activityLog).values({
  groupId: group.id,
  userId,
  action: 'group_created',
  entityType: 'group',
  entityId: group.id
});
```

### Adding an Expense
```typescript
// 1. Validate user is group member
const membership = await db.select()
  .from(groupMember)
  .where(/* conditions */);

// 2. Insert expense record
const expense = await db.insert(expenseTable).values({
  groupId,
  paidBy: userId,
  amount,
  description,
  category,
  date
}).returning();

// 3. Insert participants
for (const participant of participants) {
  await db.insert(expenseParticipant).values({
    expenseId: expense.id,
    userId: participant.userId,
    shareAmount: participant.shareAmount
  });
}

// 4. Log activity
await db.insert(activityLog).values({
  groupId,
  userId,
  action: 'expense_added',
  entityType: 'expense',
  entityId: expense.id,
  metadata: JSON.stringify({ amount, description })
});
```

## Security Considerations

### Authentication
- All routes protected by Better Auth
- Session validation on every request
- Secure cookie handling

### Authorization
```typescript
// Check group membership
const isMember = await checkGroupMembership(userId, groupId);
if (!isMember) {
  return new Response('Forbidden', { status: 403 });
}

// Check admin role for privileged operations
const isAdmin = membership.role === 'admin';
if (!isAdmin && privilegedOperation) {
  return new Response('Insufficient permissions', { status: 403 });
}
```

### Input Validation
- Sanitize all user inputs
- Validate amounts are positive
- Check date formats
- Verify user references

## Performance Optimizations

### Database Queries
- Use indexes on frequently queried columns
- Batch operations where possible
- Implement pagination for large datasets

### Caching Strategy
- Cache group membership checks
- Store calculated balances temporarily
- Invalidate on data changes

### Frontend Optimizations
- Lazy load components
- Implement virtual scrolling for long lists
- Optimize re-renders with React.memo

## Testing Checklist

### Unit Tests
- [ ] Balance calculation algorithms
- [ ] Settlement optimization logic
- [ ] Input validation functions
- [ ] Date formatting utilities

### Integration Tests
- [ ] API endpoint responses
- [ ] Database operations
- [ ] Authentication flows
- [ ] Authorization checks

### E2E Tests
- [ ] Complete user journey
- [ ] Group creation and management
- [ ] Expense tracking workflow
- [ ] Settlement process

## Deployment Considerations

### Environment Variables
```env
POSTGRES_URL=             # Database connection
BETTER_AUTH_SECRET=       # Auth secret key
GOOGLE_CLIENT_ID=         # OAuth credentials
GOOGLE_CLIENT_SECRET=     # OAuth credentials
NEXT_PUBLIC_APP_URL=      # Application URL
```

### Database Migrations
```bash
npm run db:generate       # Generate migrations
npm run db:migrate        # Apply migrations
npm run db:push          # Push schema changes
```

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Rate limiting enabled
- [ ] Monitoring configured
- [ ] Backup strategy implemented