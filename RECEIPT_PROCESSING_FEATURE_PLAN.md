# Receipt Processing & Item Claiming Feature Plan

## 🧾 **Feature Overview**

Allow users to upload receipt images, automatically extract line items using AI, enable real-time claiming of individual items by group members, and calculate proportional splits including tax and tip.

## 🔄 **User Flow**

### **Complete Workflow:**
1. **Upload Receipt** → AI extracts all line items and totals
2. **Item Claiming Interface** → Users claim individual items in real-time
3. **Split Remaining Items** → Bulk split any unclaimed items among selected users
4. **Auto-Calculate** → Proportional splits with tax/tip distribution
5. **Create Expense** → Generate final expense with exact per-person amounts

---

## 🚀 **Detailed Implementation Plan**

### **Phase 1: Receipt Upload & AI Processing**

**User Action:**
- Upload receipt image via drag & drop or file picker
- Show processing animation: "Reading receipt..."

**Backend Processing:**
1. Validate image (format, size within limits)
2. Send to OpenAI Vision API for extraction
3. Parse response into structured data
4. Create receipt session in database
5. Return session ID and extracted data

**AI Extraction Target:**
```json
{
  "merchant": "Target Store",
  "date": "2025-09-15",
  "items": [
    {"name": "Organic Milk", "price": 3.99},
    {"name": "Bread Loaf", "price": 2.49},
    {"name": "Free Range Eggs", "price": 4.99}
  ],
  "subtotal": 11.47,
  "tax": 0.92,
  "tip": 2.30,
  "total": 14.69
}
```

### **Phase 2: Real-Time Item Claiming**

**Claiming Interface Features:**
- Display all extracted items in a clean list
- Show current claim status for each item (individual or shared)
- Real-time updates when others claim/unclaim items
- Running totals for each user with shared item calculations
- Progress indicator showing completion status

**Core Functionality:**
- Click to claim/unclaim individual items
- **Multiple people CAN claim the same item** (shared items)
- Shared items automatically split cost equally among claimers
- Live updates via WebSocket or Server-Sent Events
- Show who claimed what with user avatars/names
- Visual distinction between individual and shared claims

### **Phase 3: Split Remaining Items**

**New Feature: Bulk Split Unclaimed Items**
- Button: "Split Remaining Items"
- Modal appears showing:
  - List of unclaimed items
  - Checkboxes for group members to include in split
  - Preview of per-person cost for split items
- Options:
  - **Equal Split**: Divide remaining items equally among selected users
  - **Add to Specific Person**: Assign all remaining to one person
- Updates claiming interface in real-time after split

**Split Logic:**
```typescript
// Equal split of remaining items
const splitRemainingItems = (unclaimedItems, selectedUsers) => {
  const totalValue = unclaimedItems.reduce((sum, item) => sum + item.price, 0);
  const perPersonShare = totalValue / selectedUsers.length;
  
  // Create virtual "split item" for each user
  return selectedUsers.map(user => ({
    userId: user.id,
    virtualItem: {
      name: `Split of ${unclaimedItems.length} remaining items`,
      price: perPersonShare
    }
  }));
};
```

### **Phase 4: Smart Calculation**

**Calculation Trigger:**
- "Calculate Final Expense" button appears when all items are claimed/split
- Validates that total claimed amount matches receipt total
- Calculates proportional tax and tip distribution

**Proportional Tax/Tip Logic (with Shared Items):**
```typescript
const calculateFinalSplit = (claimedItems, tax, tip) => {
  // Calculate each person's base amount including shared items
  const userTotals = {};
  const receiptSubtotal = claimedItems.reduce((sum, item) => sum + item.price, 0);
  
  claimedItems.forEach(item => {
    const sharePerPerson = item.price / item.claimedBy.length; // Split among claimers
    
    item.claimedBy.forEach(userId => {
      if (!userTotals[userId]) userTotals[userId] = 0;
      userTotals[userId] += sharePerPerson;
    });
  });
  
  // Apply proportional tax and tip based on each person's total
  return Object.entries(userTotals).map(([userId, baseAmount]) => {
    const proportion = baseAmount / receiptSubtotal;
    return {
      userId,
      baseAmount,
      taxShare: proportion * tax,
      tipShare: proportion * tip,
      totalAmount: baseAmount + (proportion * (tax + tip))
    };
  });
};
```

### **Phase 5: Expense Creation**

**Final Step:**
- Create standard expense record with calculated splits
- Add metadata linking back to original receipt session
- Show success message with breakdown
- Redirect to expense view

---

## 🗄️ **Database Schema**

### **New Tables:**

```sql
-- Receipt processing sessions
CREATE TABLE receipt_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    merchant_name TEXT,
    receipt_date DATE,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    tip_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing', -- 'processing', 'claiming', 'completed', 'cancelled'
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
    expense_id UUID REFERENCES expenses(id), -- Link to final expense
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Individual receipt items extracted by AI
CREATE TABLE receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_session_id UUID NOT NULL REFERENCES receipt_sessions(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    item_price DECIMAL(10,2) NOT NULL,
    order_index INTEGER NOT NULL, -- preserve order from receipt
    is_split_item BOOLEAN DEFAULT FALSE, -- true for virtual split items
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Item claims (who claimed what - supports multiple claimers per item)
CREATE TABLE receipt_item_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_item_id UUID NOT NULL REFERENCES receipt_items(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_type TEXT NOT NULL DEFAULT 'user', -- 'user' or 'placeholder'
    claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(receipt_item_id, user_id) -- prevent same user claiming same item twice
    -- Note: Multiple users can claim the same item (shared items)
);

-- Indexes for performance
CREATE INDEX idx_receipt_sessions_group_id ON receipt_sessions(group_id);
CREATE INDEX idx_receipt_sessions_status ON receipt_sessions(status);
CREATE INDEX idx_receipt_sessions_expires_at ON receipt_sessions(expires_at);
CREATE INDEX idx_receipt_items_session_id ON receipt_items(receipt_session_id);
CREATE INDEX idx_receipt_item_claims_item_id ON receipt_item_claims(receipt_item_id);
CREATE INDEX idx_receipt_item_claims_user_id ON receipt_item_claims(user_id);
```

---

## 🔌 **API Endpoints**

### **Receipt Processing APIs:**
```typescript
POST   /api/groups/[id]/receipts/upload
// Upload receipt image, process with AI, create session

GET    /api/groups/[id]/receipts/[sessionId]
// Get receipt session data with items and claims

POST   /api/groups/[id]/receipts/[sessionId]/claim
// Claim or unclaim specific items
// Body: { itemId: string, action: 'claim' | 'unclaim' }

POST   /api/groups/[id]/receipts/[sessionId]/split-remaining
// Split all unclaimed items among selected users
// Body: { userIds: string[], splitType: 'equal' | 'assign', assignToUser?: string }

POST   /api/groups/[id]/receipts/[sessionId]/calculate
// Calculate final splits and create expense

DELETE /api/groups/[id]/receipts/[sessionId]
// Cancel/delete receipt session

GET    /api/groups/[id]/receipts/[sessionId]/stream
// Server-sent events for real-time updates
```

---

## 🎨 **UI/UX Design**

### **Receipt Upload Screen:**
```
┌─────────────────────────────────────┐
│ 📷 Upload Receipt                   │
├─────────────────────────────────────┤
│                                     │
│     [Drag & Drop Area]              │
│     Or click to select file         │
│                                     │
│ Supported: JPG, PNG, HEIC           │
│ Max size: 10MB                      │
│                                     │
│ [Upload Receipt] button             │
└─────────────────────────────────────┘
```

### **Item Claiming Interface (with Shared Items):**
```
┌─────────────────────────────────────┐
│ 🧾 Target Store - Sep 15, 2025      │
├─────────────────────────────────────┤
│ Claim items you had:                │
│                                     │
│ ○ Organic Milk              $3.99   │ ← Available to claim
│                                     │
│ ● Bread Loaf                $2.49   │ ← You claimed this (individual)
│   👤 You                            │
│                                     │
│ ● Bottle of Wine           $24.99   │ ← Shared item (3 people)
│   👤 You, Alice, Bob ($8.33 each)   │
│                                     │
│ ● Prawn Starter            $12.50   │ ← Shared item (2 people)  
│   👤 Alice, Charlie ($6.25 each)    │
│                                     │
│ ○ Pasta Sauce               $1.99   │ ← Unclaimed
│ ○ Cheese                    $3.49   │ ← Unclaimed
│                                     │
├─────────────────────────────────────┤
│ [Split Remaining Items] (2 items)   │
├─────────────────────────────────────┤
│ Your total: $10.82 ($2.49 + $8.33)  │
│ + Tax (proportional): $0.93         │
│ + Tip (proportional): $2.16         │
│ = Your final share: $13.91          │
│                                     │
│ Items claimed: 4/6                  │
│ [Calculate Final Expense] (disabled │
│  until all items claimed/split)     │
└─────────────────────────────────────┘
```

### **Split Remaining Items Modal:**
```
┌─────────────────────────────────────┐
│ Split Remaining Items               │
├─────────────────────────────────────┤
│ Unclaimed items (2):                │
│ • Pasta Sauce - $1.99               │
│ • Cheese - $3.49                    │
│ Total: $5.48                        │
│                                     │
│ Split among:                        │
│ ☑ You                               │
│ ☑ Alice                             │
│ ☐ Bob                               │
│                                     │
│ Split type:                         │
│ ◉ Equal split ($2.74 each)          │
│ ○ Assign all to one person          │
│                                     │
│ [Cancel] [Split Items]              │
└─────────────────────────────────────┘
```

---

## ⚡ **Real-Time Features**

### **WebSocket Events:**
```typescript
// Events sent to all session participants
interface ReceiptSessionEvents {
  'item_claimed': {
    itemId: string;
    userId: string;
    userName: string;
    userType: 'user' | 'placeholder';
    isSharedItem: boolean;
    totalClaimers: number; // How many people now claim this item
    sharePerPerson: number; // New cost per person
  };
  
  'item_unclaimed': {
    itemId: string;
    userId: string;
    remainingClaimers: number;
    newSharePerPerson: number;
  };
  
  'items_split': {
    splitItems: Array<{
      itemId: string;
      userId: string;
      userName: string;
      amount: number;
    }>;
  };
  
  'session_updated': {
    totalsClaimed: Record<string, number>;
    itemsRemaining: number;
    canCalculate: boolean;
  };
  
  'user_joined': {
    userId: string;
    userName: string;
  };
  
  'session_completed': {
    expenseId: string;
  };
}
```

### **Live Updates:**
- ✨ Smooth animations for claim/unclaim actions
- 👥 Real-time user avatars showing who claimed what
- 📊 Live total calculations for each person
- 🎯 Progress bar showing completion status
- ⚡ Instant split item updates when using bulk split

---

## 🛡️ **Security & Validation**

### **Access Control:**
- Only group members can participate in receipt sessions
- Session creator can cancel/delete sessions
- Rate limiting on upload endpoint (already implemented)

### **Data Validation:**
- Image format and size validation
- Receipt total must match sum of claimed items + tax + tip
- All items must be claimed or split before calculation
- Session expiry (2 hours) to prevent abandoned sessions

### **Privacy & Security:**
- Receipt images processed but not stored permanently
- Session data deleted after 30 days
- Audit trail for all claim actions
- Input sanitization for extracted text data

---

## 🎯 **Implementation Phases**

### **MVP (Phase 1) - Core Functionality:**
- ✅ Receipt upload and AI extraction
- ✅ Basic item claiming interface
- ✅ Split remaining items feature
- ✅ Proportional tax/tip calculation
- ✅ Final expense creation

### **Enhanced (Phase 2) - Real-Time Features:**
- ✅ WebSocket integration for live updates
- ✅ Improved UI with animations
- ✅ Better error handling and validation
- ✅ Session management and cleanup

### **Advanced (Phase 3) - Future Enhancements:**
- 📝 Edit AI-extracted data before claiming
- 🔄 Receipt re-processing if extraction fails
- 📊 Receipt history and analytics
- 📱 Mobile-optimized interface
- 🔍 Search and filter within receipts

---

## 📋 **Technical Considerations**

### **File Upload Limits:**
- Maximum file size: 10MB (already configured in request size limits)
- Supported formats: JPEG, PNG, HEIC, WebP
- Image optimization before sending to OpenAI

### **AI Processing:**
- OpenAI Vision API rate limits (existing rate limiting covers this)
- Fallback for failed extractions (manual entry mode)
- Cost estimation: ~$0.01-0.03 per receipt

### **Real-Time Performance:**
- WebSocket connection management
- Efficient state updates
- Cleanup of abandoned sessions
- Connection recovery for mobile users

### **Database Performance:**
- Indexes on frequently queried fields
- Automatic cleanup of expired sessions
- Efficient queries for claim status

---

This feature will significantly differentiate FayrShare from competitors and solve a major pain point in group expense splitting! 🚀