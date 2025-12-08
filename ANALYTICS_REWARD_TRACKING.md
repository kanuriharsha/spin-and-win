# Analytics & Reward Tracking Implementation

## Summary
Successfully implemented comprehensive reward tracking in the database. When users win prizes, the rewards are now automatically logged in the analytics collection with detailed information.

## Files Created

### 1. `backend/src/models/analytics.model.js`
New MongoDB schema for tracking all rewards granted. Fields include:
- **Identifiers**: wheelId, spinResultId, routeName
- **User Info**: surname, name, amountSpent, userId
- **Reward Details**: 
  - rewardGranted (boolean)
  - rewardType (cash, loyalty, percentage, other)
  - rewardText (winning segment)
- **Amount Tracking**:
  - cashAmount (e.g., "₹500")
  - loyaltyPoints (numeric)
  - percentageOff (discount percentage)
  - discountAmount (calculated)
  - originalPrice, finalPrice
- **Approval Workflow**: approved, approvedBy, approvedAt
- **Metadata**: sessionCreatedAt, rewardClaimedAt, userAgent, ipAddress, sessionId

Indexes for fast queries:
- wheelId + createdAt
- routeName + createdAt
- rewardGranted
- rewardType
- approved

### 2. `backend/src/routes/analytics.routes.js`
New API endpoints for analytics:

#### GET Endpoints:
- `GET /api/analytics` - All records with filters (wheelId, routeName, rewardType, rewardGranted)
- `GET /api/analytics/wheel/:wheelId` - Records for specific wheel
- `GET /api/analytics/route/:routeName` - Records for specific route
- `GET /api/analytics/type/:rewardType` - Records by reward type
- `GET /api/analytics/summary/stats` - Aggregate statistics with:
  - Total rewards, approved, pending counts
  - Breakdown by reward type
  - Total cash value distributed
  - Total loyalty points awarded
  - Total discount value given
  - Date range filtering support

#### PATCH Endpoints:
- `PATCH /api/analytics/:id/approve` - Approve/reject rewards with approver info

#### DELETE Endpoints:
- `DELETE /api/analytics/:id` - Remove analytics record

## Modified Files

### 1. `backend/src/routes/wheels.routes.js`
**Changes:**
- Added import: `const Analytics = require('../models/analytics.model');`
- Updated spin endpoint (POST /api/wheels/:wheelId/spin) to:
  - Create Analytics record when prize is granted
  - Track all reward types (cash, loyalty, percentage, other)
  - Store calculated values (discount amounts, final prices)
  - Include session and user metadata
  - Return analyticsId in response

**Key Logic:**
```javascript
// After prize is awarded, create analytics record
const analyticsRecord = await Analytics.create({
  wheelId: wheel._id,
  spinResultId: session._id,
  rewardGranted: true,
  rewardType: seg.prizeType,
  // ... other fields populated based on reward type
});
```

### 2. `backend/src/app.js`
**Changes:**
- Added import: `const analyticsRoutes = require('./routes/analytics.routes');`
- Registered route: `app.use('/api/analytics', analyticsRoutes);`

## Data Flow

1. **User Spins Wheel** → Form submitted
2. **Session Created** → SpinResult document created
3. **Prize Drawn** → Segment selected, reward determined
4. **Reward Applied**:
   - If loyalty: Points added to User model
   - If cash/percentage: Calculated and stored
5. **Analytics Recorded** → Analytics document created with all details
6. **Response Sent** → Client receives reward info + analyticsId

## Benefits

✅ **Complete Audit Trail** - Every reward is logged with timestamp, user, and details
✅ **Type Breakdown** - Easily track cash vs loyalty vs percentage rewards
✅ **Approval Workflow** - Rewards can be approved before final processing
✅ **Statistics** - Aggregate stats show total value distributed by type
✅ **Searchable** - Query by wheel, route, reward type, date range
✅ **User Tracking** - Link rewards back to specific users

## Usage Examples

### Get all pending approvals:
```bash
GET /api/analytics?rewardGranted=true
```

### Get cash rewards summary:
```bash
GET /api/analytics/summary/stats?rewardType=cash
```

### Get loyalty points awarded for a route:
```bash
GET /api/analytics/route/fisheries?rewardType=loyalty
```

### Get statistics for a date range:
```bash
GET /api/analytics/summary/stats?startDate=2025-01-01&endDate=2025-12-31
```

### Approve a reward:
```bash
PATCH /api/analytics/[recordId]/approve
{
  "approved": true,
  "approvedBy": "admin_name"
}
```
