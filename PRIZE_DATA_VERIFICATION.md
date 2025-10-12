# Prize Data Storage Verification

## Summary
Both `wheels` and `spinResults` collections are properly configured to store complete prize information including prizeType and amount.

---

## 1. Wheels Collection - Prize Data Storage

### What Gets Saved in Each Segment:
When an editor creates or updates a wheel in the Editor, each segment stores:

```javascript
{
  text: "Manchurian Biryani",        // Prize name
  color: "#e74c3c",                   // Segment color
  image: "data:image/jpeg;base64...", // Optional image
  prizeType: "cash",                  // "cash", "loyalty", or "other"
  amount: "₹500",                     // Prize amount/details
  dailyLimit: 10,                     // Optional daily limit
  dailyRemaining: 8,                  // Remaining for today
  rules: []                           // Amount-based rules
}
```

### How It Works:
1. Editor UI has Prize Type dropdown and Amount input field
2. When wheel is saved, `normalizeSegments()` preserves all fields using spread operator
3. All segment data including `prizeType` and `amount` is saved to MongoDB

### Database Query to Verify:
```javascript
// View wheel segments with prize details
db.wheels.findOne(
  { routeName: "bawarchi" },
  { 
    name: 1, 
    "segments.text": 1, 
    "segments.prizeType": 1, 
    "segments.amount": 1 
  }
)
```

---

## 2. SpinResults Collection - Prize Data Storage

### What Gets Saved After Each Spin:
When a user wins a prize, the complete details are saved:

```javascript
{
  wheelId: ObjectId("..."),
  routeName: "bawarchi",
  surname: "k",
  name: "k",
  amountSpent: "800",
  inTime: ISODate("2025-10-12T..."),
  outTime: ISODate("2025-10-12T..."),
  
  // Prize Details - ALL SAVED ✅
  winner: "Manchurian Biryani",      // Prize name
  prizeType: "cash",                  // Type: cash/loyalty/other
  prizeAmount: "₹500",                // Amount/details
  userId: ObjectId("..."),            // If loyalty points awarded
  
  approved: false,
  userAgent: "Mozilla/5.0...",
  ipAddress: "::1",
  sessionId: "1760284498194-13b9f4c971ef6"
}
```

### Two Ways Prize Details Are Saved:

#### Method 1: Direct Save (Server Spin Endpoint)
When backend picks the winner via `/api/wheels/:id/spin`:
```javascript
session.winner = seg.text;
session.prizeType = seg.prizeType || 'other';
session.prizeAmount = seg.amount || '';
session.userId = userId;  // If loyalty points
await session.save();
```

#### Method 2: Frontend Update (Result Endpoint)
Frontend also sends prize details via `/api/spin-results/session/:sessionId/result`:
```javascript
{
  winner: prizeText,
  prizeType: prizeType,
  prizeAmount: prizeAmount
}
```

### Database Query to Verify:
```javascript
// View spin results with prize details
db.spinResults.find(
  {},
  {
    winner: 1,
    prizeType: 1,
    prizeAmount: 1,
    surname: 1,
    name: 1,
    amountSpent: 1,
    outTime: 1
  }
).sort({ outTime: -1 }).limit(10)
```

---

## 3. Loyalty Points Additional Storage

When a loyalty prize is won, additional data is stored in the `users` collection:

```javascript
{
  surname: "k",
  name: "k",
  phone: "",
  email: "",
  loyaltyPoints: 30,                  // Total accumulated points
  pointsHistory: [
    {
      wheelId: ObjectId("..."),
      spinResultId: ObjectId("..."),
      points: 30,                      // Points from this spin
      prize: "Loyalty Bonus",
      timestamp: ISODate("2025-10-12T...")
    }
  ]
}
```

### Database Query to Verify:
```javascript
// View users with loyalty points
db.users.find(
  {},
  {
    surname: 1,
    name: 1,
    loyaltyPoints: 1,
    "pointsHistory.points": 1,
    "pointsHistory.prize": 1,
    "pointsHistory.timestamp": 1
  }
)
```

---

## 4. Complete Data Flow

### Step-by-Step:

1. **Editor Creates Wheel**
   - Sets Prize Type: "Cash Prize"
   - Sets Amount: "₹500"
   - Saves to `wheels` collection with `prizeType: "cash"`, `amount: "₹500"`

2. **User Spins Wheel**
   - Backend picks winning segment
   - Reads `seg.prizeType` and `seg.amount` from wheel
   - Saves to `spinResults` with all prize details

3. **For Loyalty Points**
   - Extracts numeric value from amount (e.g., "30 Loyalty Points" → 30)
   - Finds/creates user
   - Adds to `loyaltyPoints` total
   - Records in `pointsHistory`
   - Links `userId` in spinResults

---

## 5. Testing Checklist

### Test Wheels Collection:
- [ ] Create wheel with cash prize (prizeType: "cash", amount: "₹500")
- [ ] Create wheel with loyalty prize (prizeType: "loyalty", amount: "30 Loyalty Points")
- [ ] Create wheel with other prize (prizeType: "other", amount: "Free Dessert")
- [ ] Verify all segments show prizeType and amount in MongoDB

### Test SpinResults Collection:
- [ ] Spin and win cash prize
- [ ] Verify spinResults has winner, prizeType: "cash", prizeAmount: "₹500"
- [ ] Spin and win loyalty points
- [ ] Verify spinResults has winner, prizeType: "loyalty", prizeAmount: "30 Loyalty Points", userId
- [ ] Spin and win other prize
- [ ] Verify spinResults has winner, prizeType: "other", prizeAmount

### Test Users Collection:
- [ ] Win loyalty points prize
- [ ] Verify user created with loyaltyPoints: 30
- [ ] Verify pointsHistory has entry with prize details
- [ ] Win loyalty points again
- [ ] Verify loyaltyPoints incremented, new history entry added

---

## 6. MongoDB Compass Queries for Verification

### Check Wheels Have Prize Data:
```javascript
db.wheels.aggregate([
  { $unwind: "$segments" },
  { $project: {
      name: 1,
      routeName: 1,
      "segment_text": "$segments.text",
      "segment_prizeType": "$segments.prizeType",
      "segment_amount": "$segments.amount"
  }},
  { $limit: 20 }
])
```

### Check SpinResults Have Prize Data:
```javascript
db.spinResults.aggregate([
  { $match: { winner: { $exists: true } } },
  { $project: {
      winner: 1,
      prizeType: 1,
      prizeAmount: 1,
      surname: 1,
      name: 1,
      amountSpent: 1,
      outTime: 1
  }},
  { $sort: { outTime: -1 } },
  { $limit: 10 }
])
```

### Check Users with Loyalty Points:
```javascript
db.users.aggregate([
  { $match: { loyaltyPoints: { $gt: 0 } } },
  { $project: {
      surname: 1,
      name: 1,
      loyaltyPoints: 1,
      totalTransactions: { $size: "$pointsHistory" },
      lastTransaction: { $arrayElemAt: ["$pointsHistory", -1] }
  }}
])
```

---

## 7. Expected Results

After creating wheels and users spinning:

### In wheels collection:
✅ Each segment has `prizeType` and `amount` fields
✅ Values match what was entered in Editor

### In spinResults collection:
✅ Each completed spin has `winner`, `prizeType`, and `prizeAmount`
✅ Loyalty wins also have `userId` reference

### In users collection:
✅ Users who won loyalty points have records
✅ `loyaltyPoints` shows total accumulated
✅ `pointsHistory` shows all transactions with details

---

## Current Implementation Status

✅ **Wheels Model**: Has prizeType and amount in segments schema  
✅ **SpinResult Model**: Has prizeType, prizeAmount, userId fields  
✅ **User Model**: Tracks loyaltyPoints and pointsHistory  
✅ **Wheels Routes**: normalizeSegments preserves all segment fields  
✅ **Spin Endpoint**: Saves prizeType and prizeAmount to session  
✅ **Result Endpoint**: Accepts and saves prize details from frontend  
✅ **Frontend Editor**: Has Prize Type dropdown and Amount input  
✅ **Frontend CustomWheel**: Sends prize details when saving results  

**Status: FULLY IMPLEMENTED ✅**

All prize data (type and amount) is being saved to both wheels and spinResults collections!
