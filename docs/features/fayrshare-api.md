# FayrShare API Reference

## Authentication
All API endpoints require authentication via Better Auth session cookies, except for public invite endpoints.

## Groups API

### Create Group
```
POST /api/groups
```
**Request Body:**
```json
{
  "name": "Summer Trip 2024",
  "description": "Expenses for our road trip"
}
```
**Response:** Created group object with ID and invite code

### Get User's Groups
```
GET /api/groups
```
**Response:** Array of groups where user is a member

### Get Group Details
```
GET /api/groups/[id]
```
**Response:** Group details with member count and user role

## Expenses API

### List Group Expenses
```
GET /api/groups/[id]/expenses
```
**Response:** Array of expenses with participant details

### Create Expense
```
POST /api/groups/[id]/expenses
```
**Request Body:**
```json
{
  "description": "Dinner at restaurant",
  "amount": 150.00,
  "category": "Food",
  "date": "2024-01-15T20:00:00Z",
  "participants": [
    {
      "userId": "user-123",
      "shareAmount": 50.00
    },
    {
      "userId": "user-456",
      "shareAmount": 50.00
    },
    {
      "userId": "user-789",
      "shareAmount": 50.00
    }
  ]
}
```
**Response:** Created expense object

### Delete Expense
```
DELETE /api/groups/[id]/expenses/[expenseId]
```
**Response:** Success status

## Members API

### List Group Members
```
GET /api/groups/[id]/members
```
**Response:** Array of members with user details and roles

### Update Member Role
```
PATCH /api/groups/[id]/members/[userId]
```
**Request Body:**
```json
{
  "role": "admin"
}
```
**Response:** Updated member object

### Remove Member
```
DELETE /api/groups/[id]/members/[userId]
```
**Response:** Success status

## Financial API

### Get Balances
```
GET /api/groups/[id]/balances
```
**Response:**
```json
{
  "balances": {
    "user-123": {
      "balance": -25.50,
      "paid": 200.00,
      "share": 174.50,
      "owes": [],
      "owedBy": [
        {
          "userId": "user-456",
          "amount": 25.50
        }
      ]
    }
  },
  "groupTotal": 500.00,
  "settled": false
}
```

### Get Settlement Plan
```
GET /api/groups/[id]/settlements
```
**Response:**
```json
{
  "settlements": [
    {
      "from": {
        "id": "user-456",
        "name": "Jane Doe"
      },
      "to": {
        "id": "user-123",
        "name": "John Smith"
      },
      "amount": 25.50
    }
  ],
  "totalTransactions": 2,
  "isOptimized": true
}
```

## Activity API

### Get Activity Log
```
GET /api/groups/[id]/activity
```
**Query Parameters:**
- `limit` (optional): Number of items to return (default: 50)
- `offset` (optional): Pagination offset

**Response:** Array of activity log entries

## Invite API

### Get Group by Invite Code
```
GET /api/invite/[code]
```
**Response:** Group details if valid code

### Join Group via Invite
```
POST /api/invite/[code]
```
**Response:** Success with redirect URL

### Generate New Invite Code
```
POST /api/groups/[id]/invite
```
**Response:** New invite code (admin only)

## Error Responses

All endpoints return consistent error responses:

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 400 Bad Request
```json
{
  "error": "Validation error message"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Authentication endpoints: 5 requests per minute
- Read endpoints: 100 requests per minute
- Write endpoints: 30 requests per minute

## Webhooks (Future)

Planned webhook events:
- `expense.created`
- `expense.updated`
- `expense.deleted`
- `member.joined`
- `member.left`
- `group.settled`