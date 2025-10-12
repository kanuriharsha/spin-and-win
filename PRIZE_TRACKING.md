# Prize Tracking in spinResults Collection

## What Gets Saved to Database

When a user spins the wheel and wins a prize, the following information is saved to the `spinResults` collection:

### Basic Information
- `winner`: The prize name/text (e.g., "Manchurian Biryani")
- `prizeType`: The type of prize - one of:
  - `'cash'` - Cash prizes
  - `'loyalty'` - Loyalty points
  - `'other'` - Other prizes
- `prizeAmount`: The amount/details (e.g., "₹500", "30 Loyalty Points")

### User Information
- `surname`: User's surname
- `name`: User's full name
- `amountSpent`: Amount spent on food (from form)

### Prize Details Examples

#### Cash Prize
```json
{
  "winner": "Manchurian Biryani",
  "prizeType": "cash",
  "prizeAmount": "₹500"
}
```

#### Loyalty Points Prize
```json
{
  "winner": "Loyalty Bonus",
  "prizeType": "loyalty",
  "prizeAmount": "30 Loyalty Points",
  "userId": "507f1f77bcf86cd799439011"
}
```

#### Other Prize
```json
{
  "winner": "Free Dessert",
  "prizeType": "other",
  "prizeAmount": "1 Free Ice Cream"
}
```

## How Loyalty Points Work

When a user wins a loyalty prize:

1. **Prize Amount Extraction**: The system extracts the numeric value from `prizeAmount`
   - Example: "30 Loyalty Points" → 30 points

2. **User Lookup/Creation**: 
   - Searches for existing user by `surname` + `name`
   - Creates new user if not found

3. **Points Award**:
   - Adds points to user's `loyaltyPoints` total
   - Records transaction in user's `pointsHistory` array

4. **Database Updates**:
   - `spinResults` document gets `userId` linking to the user
   - `users` collection tracks cumulative points and history

## Database Collections

### spinResults
- Stores every spin with complete prize details
- Links to user when loyalty points awarded

### users
- Tracks loyalty point balances
- Maintains full transaction history

### wheels
- Segments contain `prizeType` and `amount` fields
- Editor configures these values

## Viewing Data in MongoDB

To see prize details in spinResults:
```javascript
db.spinResults.find({}, {
  winner: 1,
  prizeType: 1,
  prizeAmount: 1,
  surname: 1,
  name: 1,
  amountSpent: 1,
  outTime: 1
})
```

To see users with loyalty points:
```javascript
db.users.find({}, {
  surname: 1,
  name: 1,
  loyaltyPoints: 1,
  pointsHistory: 1
})
```
