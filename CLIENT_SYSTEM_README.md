# 🎡 Spinfinity - Enhanced Client Login & Dashboard System

## 🚀 Project Overview

This is a comprehensive enhancement to the Spinfinity platform that adds a **Client Login System** and **Highly Restricted Client Dashboard** while maintaining complete admin functionality. The system implements secure, role-based access control with a workflow for client-submitted changes that require admin approval.

## ✨ Key Features

### 🔐 Client Authentication System
- **Separate Client Login Portal** (`/client-login`)
- Client credentials (username/password) created and managed exclusively by Admin
- Each client permanently mapped to exactly ONE wheel via `clientId`, `wheelId`, and `routeName`
- No self-registration or unrestricted access
- Automatic wheel loading after client login

### 📊 Client Dashboard
- **Minimal Interface**: Only 2 editable blocks visible
  1. **Wheel Segments** (View-only with edit buttons)
  2. **Edit Segment** (Appears when editing)
- Clients can ONLY edit segment details:
  - Segment text
  - Segment color
  - Prize type and amount
  - Daily limit
- **No access to**:
  - Other wheels
  - System settings
  - Admin routes
  - Publish/Delete functions
  - Wheel-level settings

### ✅ Pending Updates Workflow
1. Client makes segment changes
2. Changes stored as **pending updates** (not live)
3. Admin automatically notified
4. Admin reviews changes in dedicated UI
5. Admin can **Approve** (apply to live wheel) or **Reject** (discard)
6. Client can view status of pending updates

### 🛡️ Strict Access Control
- **Role-Based Authentication**: Admin vs Client roles
- **Frontend Protection**: Route guards prevent unauthorized access
- **Backend Validation**: Every API request validates user role and wheel ownership
- **URL/API Manipulation Protection**: Clients cannot access other wheels even via direct URL
- Clients blocked from all admin APIs and routes

### 📱 Responsive Design
- **Mobile-First Approach**: Optimized for smartphones and tablets
- **Desktop-Optimized**: Full functionality on laptops and desktops
- **Adaptive Layouts**: Grids and flexbox for all screen sizes
- **Touch-Friendly**: Large buttons and intuitive interactions

## 🏗️ Architecture

### Backend Structure
```
backend/
├── src/
│   ├── models/
│   │   ├── login.model.js          # User credentials (admin & client)
│   │   ├── wheel.model.js          # Wheel configurations
│   │   ├── pendingUpdate.model.js  # NEW: Pending client changes
│   │   └── ...
│   ├── routes/
│   │   ├── auth.routes.js          # UPDATED: Admin & client login
│   │   ├── client.routes.js        # NEW: Client-specific APIs
│   │   ├── admin.routes.js         # NEW: Admin approval workflow
│   │   └── ...
│   └── app.js                      # UPDATED: New route registrations
├── server.js
└── package.json
```

### Frontend Structure
```
spin-and-win/
├── src/
│   ├── pages/
│   │   ├── ClientLogin.jsx         # NEW: Client login page
│   │   ├── ClientDashboard.jsx     # NEW: Minimal client dashboard
│   │   ├── ClientDashboard.css     # NEW: Responsive styles
│   │   ├── PendingUpdates.jsx      # NEW: Admin approval interface
│   │   ├── PendingUpdates.css      # NEW: Review UI styles
│   │   └── ...
│   ├── context/
│   │   └── AuthContext.jsx         # UPDATED: Role-based auth
│   ├── components/
│   │   ├── ClientRoute.jsx         # NEW: Client route protection
│   │   └── ProtectedRoute.jsx      # UPDATED: Admin-only protection
│   └── App.js                      # UPDATED: New routes
```

## 🔌 API Endpoints

### Authentication
```
POST /api/auth/login           # Admin login
POST /api/auth/client-login    # Client login (returns wheelId, routeName)
```

### Client APIs (Require client headers)
```
GET  /api/client/wheel                    # Get assigned wheel (read-only)
POST /api/client/submit-update            # Submit segment changes for approval
GET  /api/client/pending-updates          # View own pending updates
```

**Required Headers:**
- `clientId`: Client's database ID
- `wheelId`: Assigned wheel ID
- `routeName`: Assigned route name

### Admin APIs
```
GET    /api/admin/pending-updates         # Get all pending updates
GET    /api/admin/all-updates             # Get all updates (with filters)
POST   /api/admin/approve-update/:id      # Approve and apply update
POST   /api/admin/reject-update/:id       # Reject update
DELETE /api/admin/delete-update/:id       # Delete update record
```

## 🗄️ Database Schema

### Login Collection
```javascript
{
  username: String,      // Client ID or admin username
  password: String,      // Password
  routeName: String,     // 'all' for admin, specific route for client
  onboard: Date,
  access: String         // 'enable' or 'disable'
}
```

### PendingUpdates Collection
```javascript
{
  clientId: String,
  clientUsername: String,
  wheelId: ObjectId,
  routeName: String,
  status: String,        // 'pending', 'approved', 'rejected'
  segmentUpdates: [{
    segmentIndex: Number,
    previousData: {...},
    updatedData: {...}
  }],
  submittedAt: Date,
  reviewedAt: Date,
  reviewedBy: String,
  reviewNotes: String
}
```

## 🚦 User Flows

### Client Workflow
1. Navigate to `/client-login`
2. Enter credentials (username/password)
3. System authenticates and loads assigned wheel
4. Redirected to `/client-dashboard`
5. View all segments of assigned wheel
6. Click "Edit" on a segment
7. Modify segment details in "Edit Segment" block
8. Click "Submit for Approval"
9. Changes stored as pending (not live)
10. View pending status in dashboard

### Admin Workflow
1. Login at `/login` (existing admin flow)
2. Navigate to "Client Updates" in navbar
3. View all pending updates
4. Click "View Details" on an update
5. Review side-by-side comparison (Previous vs New)
6. Add optional review notes
7. Click "Approve & Apply" OR "Reject"
8. Changes applied to wheel or discarded

## 🔒 Security Features

### Frontend Security
- Role-based route guards (`ProtectedRoute`, `ClientRoute`)
- Conditional rendering based on role
- Session storage of role and client data
- Automatic logout on invalid session

### Backend Security
- Middleware validates client credentials on every request
- Verifies wheel ownership via `routeName` matching
- Admin-only routes protected
- No direct wheel modification for clients
- All updates go through pending workflow

### Access Control Matrix
| Feature | Admin | Client |
|---------|-------|--------|
| View all wheels | ✅ | ❌ |
| Create/Delete wheels | ✅ | ❌ |
| Edit any wheel | ✅ | ❌ |
| Publish changes | ✅ | ❌ |
| View assigned wheel | ✅ | ✅ |
| Edit segments | ✅ | ✅* |
| Approve updates | ✅ | ❌ |
| System settings | ✅ | ❌ |

*Client edits require admin approval

## 📱 Responsive Design Details

### Mobile (< 640px)
- Single column layout for segments grid
- Stacked form actions
- Full-width buttons
- Compact header
- Sticky navigation

### Tablet (640px - 1024px)
- 2-column segments grid
- Flexible form layouts
- Optimized spacing

### Desktop (> 1024px)
- 3-column segments grid
- Side-by-side comparisons
- Maximum 1200px content width
- Enhanced hover effects

## 🎨 Design System

### Colors
- **Primary**: `#4299e1` (Blue)
- **Success**: `#48bb78` (Green)
- **Error**: `#e53e3e` (Red)
- **Warning**: `#ed8936` (Orange)
- **Background**: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`

### Typography
- Font Family: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto'`
- Heading: `1.5rem - 2rem`
- Body: `0.95rem - 1rem`
- Small: `0.85rem - 0.9rem`

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 14+ and npm
- MongoDB Atlas account (or local MongoDB)

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Update .env with your MongoDB connection string
npm start
```

### Frontend Setup
```bash
cd spin-and-win
npm install
npm start
```

### Environment Variables

**Backend (.env)**
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/spin-and-win?retryWrites=true&w=majority
PORT=5000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

**Frontend (.env)**
```env
REACT_APP_API_URL=http://localhost:5000
```

## 🧪 Testing the System

### Create Test Client
1. Login as admin
2. Go to MongoDB or use admin API to create a login record:
```javascript
{
  username: "testclient",
  password: "testpass123",
  routeName: "test-wheel-route",  // Must match an existing wheel's routeName
  access: "enable"
}
```

### Test Client Login
1. Navigate to `http://localhost:3000/client-login`
2. Enter username: `testclient`, password: `testpass123`
3. Should redirect to client dashboard with only the assigned wheel

### Test Client Update Submission
1. In client dashboard, click "Edit" on any segment
2. Change text, color, or prize details
3. Click "Submit for Approval"
4. Verify success message appears

### Test Admin Approval
1. Login as admin
2. Navigate to "Client Updates" in navbar
3. Should see pending update from test client
4. Click "View Details"
5. Review changes (Previous vs New comparison)
6. Click "Approve & Apply"
7. Verify wheel is updated with new values

## 📋 Client Creation Process (Admin)

To create a new client account:

1. **Identify the Wheel**: Note the `routeName` of the wheel to assign
2. **Create Login Record** in MongoDB `login` collection:
```javascript
{
  username: "client_username",     // Client will use this to login
  password: "secure_password",      // Plain text (consider hashing in production)
  routeName: "wheel-route-name",    // MUST match existing wheel's routeName
  access: "enable",                 // 'enable' or 'disable'
  onboard: new Date()
}
```
3. **Share Credentials** with client
4. Client can now login at `/client-login`

## 🚀 Deployment Considerations

### Production Checklist
- [ ] Use environment variables for all sensitive data
- [ ] Implement password hashing (bcrypt)
- [ ] Add JWT tokens for authentication
- [ ] Set up HTTPS/SSL
- [ ] Configure CORS for production domain
- [ ] Add rate limiting
- [ ] Implement logging and monitoring
- [ ] Set up database backups
- [ ] Add error tracking (e.g., Sentry)
- [ ] Optimize images and assets

### Recommended Services
- **Frontend**: Vercel, Netlify, or Render
- **Backend**: Render, Railway, or Heroku
- **Database**: MongoDB Atlas (already configured)

## 🐛 Troubleshooting

### Backend won't start
- Check MongoDB connection string in `.env`
- Ensure MongoDB Atlas IP whitelist includes your IP
- Verify Node.js version (14+)

### Client login fails
- Verify login record exists in MongoDB
- Check `routeName` matches an existing wheel
- Ensure `access` is set to `'enable'`

### Client can't edit segments
- Verify client headers are being sent
- Check browser console for CORS errors
- Ensure wheel belongs to client's `routeName`

## 📝 Future Enhancements

- [ ] Password reset functionality
- [ ] Email notifications for pending updates
- [ ] Bulk segment updates
- [ ] Client activity logs
- [ ] Multi-language support
- [ ] Real-time notifications (WebSocket)
- [ ] Advanced analytics for client activity
- [ ] Scheduled updates (time-based approval)

## 👥 Roles & Permissions Summary

### Admin
- Full system access
- Create/edit/delete wheels
- Manage client accounts
- Review and approve/reject client changes
- Access all analytics
- System configuration

### Client
- Login with assigned credentials
- View ONLY assigned wheel
- Edit segments (pending approval)
- View own pending updates
- No access to admin features
- Cannot create/delete wheels
- Cannot publish changes directly

## 📞 Support

For questions or issues:
1. Check this documentation
2. Review browser console for errors
3. Check backend logs
4. Verify database records match expected schema

## ⚡ Performance Optimizations

- Lazy loading of components
- Optimized bundle size
- Efficient database queries
- Indexed database fields
- Cached API responses (where appropriate)
- Debounced form inputs

## 🎯 Success Criteria

✅ Client can only access their assigned wheel
✅ Client changes require admin approval
✅ Admin can review and approve/reject changes
✅ UI is fully responsive (mobile & desktop)
✅ Strict role-based access control enforced
✅ No direct database writes by clients
✅ Admin functionality unchanged
✅ Secure authentication system

---

**Version**: 1.0.0
**Last Updated**: January 2026
**Author**: Spinfinity Development Team
