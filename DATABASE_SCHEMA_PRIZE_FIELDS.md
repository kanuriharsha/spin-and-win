# Database Schema - Prize Fields Reference

## Quick Reference: What's Stored Where

---

## 1. WHEELS Collection

### Document Structure:
```javascript
{
  _id: ObjectId("..."),
  name: "The Original Bawarchi",
  routeName: "bawarchi",
  description: "POWERED BY PEH",
  
  // Array of prize segments
  segments: [
    {
      text: "Manchurian Biryani",          // Prize display name
      color: "#e74c3c",                     // Visual color
      image: "data:image/jpeg;base64...",   // Optional segment image
      
      // ✅ PRIZE DETAILS - STORED HERE
      prizeType: "cash",                    // "cash" | "loyalty" | "other"
      amount: "₹500",                       // Free text: "₹500", "30 Loyalty Points", etc.
      
      // Availability controls
      dailyLimit: 10,                       // Max wins per day (null = unlimited)
      dailyRemaining: 8,                    // Left today
      lastResetAt: ISODate("..."),          // Last midnight reset
      
      // Amount-based rules
      rules: [
        {
          op: ">=",                          // Operator: >, >=, <, <=, ==, !=
          amount: 500,                       // When amountSpent >= 500
          dailyLimit: 5                      // Use this limit instead
        }
      ]
    },
    // ... more segments
  ],
  
  centerImage: "data:image/jpeg;base64...",
  wheelBackgroundColor: "#370606",
  wrapperBackgroundColor: "#370606",
  centerImageRadius: 160,
  spinDurationSec: 6,
  spinBaseTurns: 20,
  formConfig: { /* ... */ },
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### Prize Fields in Each Segment:
| Field | Type | Required | Description | Examples |
|-------|------|----------|-------------|----------|
| `prizeType` | String (enum) | Yes (default: 'other') | Type of prize | `'cash'`, `'loyalty'`, `'other'` |
| `amount` | String | No (default: '') | Prize amount/details | `'₹500'`, `'30 Loyalty Points'`, `'Free Dessert'` |

---

## 2. SPINRESULTS Collection

### Document Structure:
```javascript
{
  _id: ObjectId("..."),
  
  // Wheel reference
  wheelId: ObjectId("68ebcd501f6e56049625dfa2"),
  routeName: "bawarchi",
  
  // User info from form
  surname: "k",
  name: "k",
  amountSpent: "800",
  
  // Timing
  inTime: ISODate("2025-10-12T15:54:58.199Z"),
  outTime: ISODate("2025-10-12T15:55:07.397Z"),
  
  // ✅ PRIZE RESULT - STORED HERE
  winner: "Manchurian Biryani",               // Prize name that was won
  prizeType: "cash",                           // Type of prize won
  prizeAmount: "₹500",                         // Amount/details of prize won
  userId: ObjectId("..."),                     // Link to user (if loyalty points)
  
  // Status
  approved: false,
  
  // Metadata
  userAgent: "Mozilla/5.0 ...",
  ipAddress: "::1",
  sessionId: "1760284498194-13b9f4c971ef6",
  
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### Prize Fields:
| Field | Type | Required | Description | Examples |
|-------|------|----------|-------------|----------|
| `winner` | String | Yes | Prize name that was won | `'Manchurian Biryani'`, `'Loyalty Bonus'` |
| `prizeType` | String (enum) | Yes (default: 'other') | Type of prize won | `'cash'`, `'loyalty'`, `'other'` |
| `prizeAmount` | String | No (default: '') | Amount/details of prize won | `'₹500'`, `'30 Loyalty Points'` |
| `userId` | ObjectId | No | User who won (loyalty only) | `ObjectId("...")` |

---

## 3. USERS Collection (for Loyalty Points)

### Document Structure:
```javascript
{
  _id: ObjectId("..."),
  
  // User identification (matched by surname + name)
  surname: "k",
  name: "k",
  phone: "",                                   // Optional
  email: "",                                   // Optional
  
  // ✅ LOYALTY POINTS TRACKING
  loyaltyPoints: 60,                           // Total accumulated points
  
  // ✅ TRANSACTION HISTORY
  pointsHistory: [
    {
      wheelId: ObjectId("68ebcd501f6e56049625dfa2"),
      spinResultId: ObjectId("68e2188156d9e5f653ae9407"),
      points: 30,                              // Points awarded in this transaction
      prize: "Loyalty Bonus",                  // Prize name
      timestamp: ISODate("2025-10-12T15:55:07.397Z")
    },
    {
      wheelId: ObjectId("68ebcd501f6e56049625dfa2"),
      spinResultId: ObjectId("68e21af45cd0e123456789ab"),
      points: 30,
      prize: "Loyalty Bonus",
      timestamp: ISODate("2025-10-12T16:10:22.101Z")
    }
  ],
  
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### Loyalty Fields:
| Field | Type | Description |
|-------|------|-------------|
| `loyaltyPoints` | Number | Total cumulative points |
| `pointsHistory` | Array | All point transactions with details |
| `pointsHistory[].points` | Number | Points awarded in transaction |
| `pointsHistory[].prize` | String | Prize name from that spin |
| `pointsHistory[].timestamp` | Date | When points were awarded |

---

## 4. Data Flow Example

### Scenario: User wins "Manchurian Biryani - ₹500"

#### Step 1: Editor Sets Up (Stored in `wheels` collection)
```javascript
segments: [{
  text: "Manchurian Biryani",
  prizeType: "cash",        // ← Editor selects "Cash Prize"
  amount: "₹500"            // ← Editor enters "₹500"
}]
```

#### Step 2: User Spins & Wins (Stored in `spinResults` collection)
```javascript
{
  winner: "Manchurian Biryani",    // ← Copied from segment.text
  prizeType: "cash",                // ← Copied from segment.prizeType
  prizeAmount: "₹500"               // ← Copied from segment.amount
}
```

---

### Scenario: User wins "Loyalty Bonus - 30 Loyalty Points"

#### Step 1: Editor Sets Up (Stored in `wheels` collection)
```javascript
segments: [{
  text: "Loyalty Bonus",
  prizeType: "loyalty",     // ← Editor selects "Loyalty Points"
  amount: "30 Loyalty Points" // ← Editor enters amount
}]
```

#### Step 2: User Spins & Wins (Stored in `spinResults` collection)
```javascript
{
  winner: "Loyalty Bonus",
  prizeType: "loyalty",
  prizeAmount: "30 Loyalty Points",
  userId: ObjectId("...")   // ← Link to user who got points
}
```

#### Step 3: Points Awarded (Stored/Updated in `users` collection)
```javascript
{
  surname: "k",
  name: "k",
  loyaltyPoints: 30,        // ← Incremented by 30
  pointsHistory: [{
    points: 30,             // ← Extracted from "30 Loyalty Points"
    prize: "Loyalty Bonus",
    timestamp: ISODate("...")
  }]
}
```

---

## 5. MongoDB Compass Views

### View Prize Data in Wheels:
Click on `wheels` collection → expand any document → expand `segments` array → see `prizeType` and `amount`

### View Prize Data in SpinResults:
Click on `spinResults` collection → expand any document → see `winner`, `prizeType`, `prizeAmount`

### View Loyalty Points in Users:
Click on `users` collection → expand any document → see `loyaltyPoints` and `pointsHistory`

---

## Summary

✅ **In `wheels` collection**: Each segment stores `prizeType` and `amount`  
✅ **In `spinResults` collection**: Each result stores `winner`, `prizeType`, and `prizeAmount`  
✅ **In `users` collection**: Loyalty points tracked with full transaction history  

**All prize information (type and amount) is stored in the database!**
