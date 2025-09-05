# FairShare - Expense Splitting Application

## Overview
FairShare is a mobile-first expense tracking and splitting application designed to simplify shared expenses among groups of people. It provides real-time balance calculations, optimized settlement plans, and complete transparency through activity logging.

## Core Features

### 1. Group Management
- **Create Groups**: Users can create expense groups for any shared activity (trips, households, events)
- **Invite System**: Unique invite links allow easy member addition
- **Role Management**: Admin and member roles with appropriate permissions
- **Member Management**: Admins can promote/demote members and manage group settings

### 2. Expense Tracking
- **Add Expenses**: Log expenses with description, amount, category, and date
- **Participant Selection**: Choose which group members participated in each expense
- **Split Options**: Equal split or custom amounts per participant
- **Edit/Delete**: Modify or remove expenses with activity logging
- **Categories**: Organize expenses by type (Food, Transport, Accommodation, etc.)

### 3. Balance Calculations
- **Real-time Balances**: Instant calculation of who owes what
- **Individual Views**: See your personal balance within the group
- **Group Overview**: View all member balances at a glance
- **Detailed Breakdowns**: Understand how balances are calculated

### 4. Settlement Optimization
- **Minimal Transactions**: Algorithm calculates the minimum number of payments needed
- **Clear Instructions**: Step-by-step payment instructions
- **Copy to Clipboard**: Easy sharing of settlement plans
- **Payment Methods**: Suggestions for various payment methods

### 5. Activity Logging
- **Complete Transparency**: All actions are logged and visible
- **Chronological Feed**: See what happened when
- **User Attribution**: Know who made each change
- **Action Types**: Track expenses, member changes, and group updates

## Technical Architecture

### Database Schema
```
- user: Authentication and user profiles
- group: Expense groups with metadata
- groupMember: Group membership and roles
- expense: Individual expense records
- expenseParticipant: Expense participation details
- activityLog: Complete audit trail
```

### Technology Stack
- **Frontend**: Next.js 15, React, TypeScript
- **UI**: Tailwind CSS, shadcn/ui components
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth with Google OAuth
- **Icons**: Lucide React

### Key Algorithms

#### Settlement Optimization
The application uses a greedy algorithm to minimize transactions:
1. Calculate net balance for each member
2. Sort debtors and creditors
3. Match largest debtor with largest creditor
4. Generate minimal transaction list

## User Flow

### Getting Started
1. User signs up/logs in via Google OAuth
2. Creates a new group or joins via invite link
3. Adds group members
4. Starts tracking expenses

### Daily Usage
1. Add expenses as they occur
2. Select participants for each expense
3. View updated balances
4. Check activity log for transparency

### Settling Up
1. Navigate to Settle Up tab
2. View optimized payment plan
3. Copy instructions to share
4. Mark as settled when complete

## Security & Privacy

### Authentication
- Secure OAuth 2.0 with Google
- Session-based authentication
- Protected API endpoints

### Authorization
- Role-based access control
- Admin-only operations
- Group membership validation

### Data Protection
- User data isolated by group
- No cross-group data access
- Secure invite codes

## Mobile-First Design

### Responsive Features
- Touch-optimized interfaces
- Swipe gestures support
- Adaptive layouts
- Performance optimization

### Offline Capabilities
- Client-side validation
- Optimistic updates
- Error recovery

## Future Enhancements

### Planned Features
- Receipt photo uploads
- Currency conversion
- Recurring expenses
- Export to CSV/PDF
- Push notifications
- Payment integrations
- Budget tracking
- Expense analytics

### Technical Improvements
- WebSocket for real-time updates
- Progressive Web App (PWA)
- Offline mode with sync
- Advanced reporting

## API Documentation
See [API Reference](./fairshare-api.md) for detailed endpoint documentation.