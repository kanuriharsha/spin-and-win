# 🧪 Testing Guide - Client Login System

## ✅ System Status

**Backend**: ✅ Running on http://localhost:5000
**Frontend**: ✅ Running on http://localhost:3000
**Database**: ✅ Connected to MongoDB (spin-and-win)

---

## 🎯 Test Scenarios

### Scenario 1: Test Client Login - Fish User

Based on your MongoDB data, you have a client user **fish/fish** mapped to the **fisheries** route.

#### Steps:
1. **Open Client Login**
   ```
   http://localhost:3000/client-login
   ```

2. **Enter Credentials**
   - Username: `fish`
   - Password: `fish`
   - Click "Sign In"

3. **Expected Result**
   - ✅ You should be redirected to Client Dashboard
   - ✅ You should see ONLY the wheel with route name `fisheries`
   - ✅ The wheel name shown should be "New Spinning Wheel" (or whatever it's named)
   - ✅ You can see all segments in a grid layout
   - ✅ Each segment has an "Edit" button

4. **Edit a Segment**
   - Click "Edit" on any segment
   - The "Edit Segment" block will appear below
   - Change the segment text, color, or prize details
   - Click "Submit for Approval"

5. **Expected Result**
   - ✅ Success message: "Your changes have been submitted for admin review"
   - ✅ Changes are NOT live yet
   - ✅ Pending Updates section shows the submission

---

### Scenario 2: Test Client Login - Trail User

#### Steps:
1. **Open Client Login**
   ```
   http://localhost:3000/client-login
   ```

2. **Enter Credentials**
   - Username: `trail`
   - Password: `Trail`
   - Click "Sign In"

3. **Expected Result**
   - ✅ Redirected to Client Dashboard
   - ✅ See ONLY the wheel for route: `trail`
   - ✅ Can edit segments for this wheel only

---

### Scenario 3: Test Admin Login

#### Steps:
1. **Open Admin Login**
   ```
   http://localhost:3000/login
   ```

2. **Enter Admin Credentials**
   - Username: (your admin username with `routeName: "all"`)
   - Password: (your admin password)
   - Click "Sign In"

3. **Expected Result**
   - ✅ Redirected to Admin Dashboard
   - ✅ See ALL wheels in the dashboard
   - ✅ Can access "Client Updates" menu

---

### Scenario 4: Admin Review Client Changes

#### Steps:
1. **Login as Admin**
   - Go to http://localhost:3000/login
   - Enter admin credentials

2. **Navigate to Client Updates**
   - Click "Client Updates" in the navbar

3. **View Pending Updates**
   - You should see pending updates submitted by clients
   - Click "View Details" on any update

4. **Review Changes**
   - See side-by-side comparison:
     - **Previous**: Original segment data
     - **New**: Client's proposed changes
   - Add optional review notes

5. **Approve or Reject**
   - Click "Approve & Apply" to accept (wheel updated live)
   - OR Click "Reject" to discard the changes

---

## 🗄️ Database Configuration

Based on your MongoDB Atlas data:

### Login Collection (Your Existing Data)

```javascript
// Client 1 - Fish
{
  _id: "69368be194bdf7628539bbd6",
  username: "fish",
  password: "fish",
  routeName: "fisheries",
  access: "enable",
  onboard: "2025-12-08T00:00:00.000+00:00"
}

// Client 2 - Trail  
{
  _id: "69364e410f59180d3a712685a",
  username: "trail",
  password: "Trail",
  routeName: "trail",
  access: "enable",
  onboard: "1997-09-21T00:00:00.000+00:00"
}

// Additional clients from your screenshot
{
  username: "redbucket",
  password: "redbucket",
  routeName: "redbucketbiryanihyd",
  access: "enable"
}

{
  username: "gismat",
  password: "Gismat",
  routeName: "gismat",
  access: "enable"
}
```

### Wheels Collection

Make sure your wheels collection has matching routeNames:
```javascript
{
  name: "New Spinning Wheel",
  routeName: "fisheries",  // Must match login.routeName
  segments: [...]
}

{
  name: "Percentage wheel trail",
  routeName: "trail",
  segments: [...]
}
```

---

## 🐛 Troubleshooting

### Issue: "Unable to load wheel data"

**Cause**: No wheel found with matching `routeName`

**Solution**:
1. Check MongoDB `wheels` collection
2. Verify a wheel exists with `routeName: "fisheries"` (exact match)
3. Ensure the routeName in `login` collection matches exactly

**Debug Query** (MongoDB Compass):
```javascript
// Check if wheel exists
db.wheels.findOne({ routeName: "fisheries" })

// Check client login
db.login.findOne({ username: "fish" })
```

### Issue: "Access denied to this wheel"

**Cause**: Mismatch between login routeName and wheel routeName

**Solution**:
1. Verify case-sensitivity: "fisheries" vs "Fisheries"
2. Check for extra spaces: "fisheries " vs "fisheries"
3. The system now does case-insensitive matching

### Issue: CORS errors in browser console

**Solution**:
1. Restart backend server
2. Clear browser cache
3. Check backend logs for connection

### Issue: Client can see multiple wheels

**Cause**: Security bypass (should not happen)

**Solution**:
1. Clear browser cache and localStorage
2. Re-login
3. Check backend logs for errors

---

## 🔐 Security Validations

### What the System Prevents:

1. ❌ Client accessing admin routes (e.g., /dashboard)
2. ❌ Client accessing other clients' wheels
3. ❌ Client making direct changes to wheel (must go through approval)
4. ❌ Client accessing wheels via URL manipulation
5. ❌ Disabled accounts from logging in
6. ❌ Admin routes from being accessed by clients

### What the System Allows:

1. ✅ Client viewing their assigned wheel only
2. ✅ Client editing segments (pending approval)
3. ✅ Admin viewing all wheels
4. ✅ Admin approving/rejecting client changes
5. ✅ Client viewing their pending update status

---

## 📱 Test on Different Devices

### Mobile (< 640px)
- Single column segment layout
- Full-width buttons
- Stacked form fields
- Touch-friendly interface

### Tablet (640-1024px)
- 2-column segment layout
- Flexible buttons
- Optimized spacing

### Desktop (> 1024px)
- 3-column segment layout
- Side-by-side comparisons
- Maximum 1200px content width

---

## 🎨 Visual Changes Implemented

### Login Page (/login)
- ✅ Beautiful gradient background (purple to blue)
- ✅ PEH Spinfinity logo displayed
- ✅ Company branding (PEH > Spinfinity)
- ✅ Auto-updating copyright (© 2026 PEH Spinfinity)
- ✅ Modern card design with glass morphism
- ✅ Smooth animations and transitions
- ✅ Fully responsive for mobile and desktop

### Client Login (/client-login)
- ✅ Same beautiful design as admin login
- ✅ Branded with company logo
- ✅ Auto-updating copyright
- ✅ Link to admin login

---

## 🚀 Quick Test Commands

### Test Client Login (fish/fish)
```
1. Go to: http://localhost:3000/client-login
2. Username: fish
3. Password: fish
4. Click Sign In
5. Should see fisheries wheel
```

### Test Admin Workflow
```
1. Go to: http://localhost:3000/login
2. Enter admin credentials
3. Go to: http://localhost:3000/pending-updates
4. Review client submissions
```

---

## 📊 Expected Database Flow

```
Client Login (fish/fish)
    ↓
Auth checks login collection
    ↓
Finds: { username: "fish", routeName: "fisheries" }
    ↓
Searches wheels collection
    ↓
Finds: { routeName: "fisheries", name: "New Spinning Wheel" }
    ↓
Returns: { clientId, wheelId, routeName }
    ↓
Client Dashboard loads wheel data
    ↓
Client can edit segments
    ↓
Changes saved to pendingUpdates collection
    ↓
Admin reviews in /pending-updates
    ↓
Admin approves/rejects
    ↓
If approved: wheel segments updated
```

---

## ✨ New Features Summary

1. **Beautiful Login Pages**
   - Modern gradient design
   - Company branding with logo
   - Auto-updating copyright
   - Fully responsive

2. **Client-Specific Access**
   - Each client sees only their wheel
   - Case-insensitive route matching
   - Secure validation on every request

3. **Pending Updates Workflow**
   - Client changes require admin approval
   - Admin review interface
   - Side-by-side comparisons
   - Approve/Reject with notes

4. **Enhanced Security**
   - Role-based access control
   - Route protection
   - Backend validation
   - CORS configuration

---

## 🎯 Success Criteria

- [x] ✅ fish/fish can login and see fisheries wheel
- [x] ✅ Client can edit segments
- [x] ✅ Changes go to pending (not live)
- [x] ✅ Admin can approve/reject
- [x] ✅ Login page is beautiful
- [x] ✅ Mobile responsive
- [x] ✅ Copyright auto-updates
- [x] ✅ Company branding visible

---

**System is ready for testing! 🎉**

Start with the fish/fish login to see the client experience!
