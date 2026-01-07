# 🎡 Spinfinity Client Login System - Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SPINFINITY PLATFORM                          │
│                     Enhanced with Client System                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐              ┌──────────────────┐            │
│  │   Admin Portal   │              │  Client Portal   │            │
│  ├──────────────────┤              ├──────────────────┤            │
│  │ /login           │              │ /client-login    │            │
│  │ /dashboard       │              │ /client-dashboard│            │
│  │ /editor          │              │                  │            │
│  │ /pending-updates │              │ (Restricted)     │            │
│  │ /analytics       │              │                  │            │
│  └────────┬─────────┘              └────────┬─────────┘            │
│           │                                  │                       │
│           │         ┌──────────────┐         │                       │
│           └────────►│ AuthContext  │◄────────┘                       │
│                     │ Role: admin  │                                 │
│                     │ Role: client │                                 │
│                     └──────┬───────┘                                 │
│                            │                                          │
└────────────────────────────┼──────────────────────────────────────────┘
                             │
                             │ HTTP/HTTPS
                             │
┌────────────────────────────┼──────────────────────────────────────────┐
│                       BACKEND (Node.js/Express)                       │
├────────────────────────────┴──────────────────────────────────────────┤
│                                                                        │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                    API ROUTES                                  │   │
│  ├───────────────────────────────────────────────────────────────┤   │
│  │                                                                │   │
│  │  Authentication Routes                                         │   │
│  │  ├─ POST /api/auth/login           (Admin Login)             │   │
│  │  └─ POST /api/auth/client-login    (Client Login)            │   │
│  │                                                                │   │
│  │  Client Routes (Protected)                                     │   │
│  │  ├─ GET  /api/client/wheel         (Get Assigned Wheel)      │   │
│  │  ├─ POST /api/client/submit-update (Submit Changes)          │   │
│  │  └─ GET  /api/client/pending-updates                          │   │
│  │                                                                │   │
│  │  Admin Routes (Protected)                                      │   │
│  │  ├─ GET  /api/admin/pending-updates                           │   │
│  │  ├─ POST /api/admin/approve-update/:id                        │   │
│  │  └─ POST /api/admin/reject-update/:id                         │   │
│  │                                                                │   │
│  │  Existing Routes (Admin Only)                                  │   │
│  │  ├─ /api/wheels                                                │   │
│  │  ├─ /api/logins                                                │   │
│  │  └─ /api/analytics                                             │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                    MIDDLEWARE                                  │   │
│  ├───────────────────────────────────────────────────────────────┤   │
│  │  • CORS (origin validation)                                   │   │
│  │  • JSON body parser (50mb limit)                              │   │
│  │  • Client verification (headers: clientId, wheelId, routeName)│   │
│  │  • Error handling                                              │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                             │ Mongoose ODM
                             │
┌────────────────────────────┼───────────────────────────────────────────┐
│                     DATABASE (MongoDB Atlas)                          │
├────────────────────────────┴───────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│  │ login           │  │ wheels          │  │ pendingUpdates (NEW) │  │
│  ├─────────────────┤  ├─────────────────┤  ├──────────────────────┤  │
│  │ • username      │  │ • name          │  │ • clientId           │  │
│  │ • password      │  │ • routeName     │  │ • wheelId            │  │
│  │ • routeName     │  │ • segments[]    │  │ • routeName          │  │
│  │   - "all" =admin│  │ • centerImage   │  │ • status             │  │
│  │   - specific    │  │ • colors        │  │ • segmentUpdates[]   │  │
│  │ • access        │  │ • settings      │  │ • submittedAt        │  │
│  │ • onboard       │  │                 │  │ • reviewedAt         │  │
│  └─────────────────┘  └─────────────────┘  └──────────────────────┘  │
│                                                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│  │ spinResults     │  │ analytics       │  │ sessions             │  │
│  │ (existing)      │  │ (existing)      │  │ (existing)           │  │
│  └─────────────────┘  └─────────────────┘  └──────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### 1. Client Login Flow
```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────►│  Login   │────►│ Backend  │────►│ MongoDB  │
│  Browser │     │   Page   │     │   Auth   │     │  login   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     ▲                                   │
     │                                   │
     │         ┌──────────────────┐      │
     └─────────│ Redirect to      │◄─────┘
               │ Client Dashboard │
               │ with wheel data  │
               └──────────────────┘
```

### 2. Client Update Submission Flow
```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────────┐
│  Client  │────►│  Edit    │────►│ Backend  │────►│ pendingUpdates│
│Dashboard │     │ Segment  │     │  /client │     │  Collection   │
└──────────┘     └──────────┘     └──────────┘     └──────────────┘
     ▲                                   │
     │                                   │
     │         ┌──────────────────┐      │
     └─────────│ Success Message  │◄─────┘
               │ "Pending Review" │
               └──────────────────┘
```

### 3. Admin Approval Flow
```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────┐
│  Admin   │────►│ Pending  │────►│   Backend    │────►│  wheels  │
│Dashboard │     │ Updates  │     │/admin/approve│     │Collection│
└──────────┘     │   Page   │     └──────────────┘     └──────────┘
                 └──────────┘              │
                       │                   │
                       │    ┌──────────────┴──────────┐
                       │    │ Update pendingUpdates   │
                       └───►│ status: "approved"      │
                            │ Apply changes to wheel  │
                            └─────────────────────────┘
```

### 4. Access Control Matrix
```
┌────────────────────┬───────────┬─────────┬────────────────────┐
│     Resource       │   Admin   │ Client  │   Public           │
├────────────────────┼───────────┼─────────┼────────────────────┤
│ /login             │    ✅     │   ❌    │      ✅            │
│ /client-login      │    ❌     │   ✅    │      ✅            │
│ /dashboard         │    ✅     │   ❌    │      ❌            │
│ /client-dashboard  │    ❌     │   ✅    │      ❌            │
│ /editor            │    ✅     │   ❌    │      ❌            │
│ /pending-updates   │    ✅     │   ❌    │      ❌            │
│ /analytics         │    ✅     │   ❌    │      ❌            │
│ /:routeName (wheel)│    ✅     │   ❌    │      ✅            │
└────────────────────┴───────────┴─────────┴────────────────────┘

┌────────────────────┬───────────┬─────────┐
│    API Endpoint    │   Admin   │ Client  │
├────────────────────┼───────────┼─────────┤
│ /api/wheels        │    ✅     │   ❌    │
│ /api/logins        │    ✅     │   ❌    │
│ /api/client/wheel  │    ❌     │   ✅    │
│ /api/client/submit │    ❌     │   ✅    │
│ /api/admin/*       │    ✅     │   ❌    │
└────────────────────┴───────────┴─────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layer 1                          │
│              Frontend Route Protection                       │
│  • ProtectedRoute (admin only)                              │
│  • ClientRoute (client only)                                │
│  • Role-based conditional rendering                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                    Security Layer 2                          │
│              Backend Route Middleware                        │
│  • verifyClient() - validates client headers                │
│  • Checks clientId, wheelId, routeName                      │
│  • Verifies wheel ownership                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                    Security Layer 3                          │
│              Database Level Validation                       │
│  • Mongoose schemas with strict validation                  │
│  • Indexed fields for fast lookup                           │
│  • Unique constraints (routeName)                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                    Security Layer 4                          │
│              Pending Updates Workflow                        │
│  • Client changes not applied directly                      │
│  • Admin review required                                    │
│  • Immutable previous state preserved                       │
└─────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
App.js
│
├─── AuthProvider (Context)
│    │
│    ├─── NoNavLayout
│    │    ├─── Login (Admin)
│    │    ├─── ClientLogin (NEW)
│    │    └─── NotFound
│    │
│    └─── MainLayout
│         ├─── Navbar
│         │
│         ├─── ProtectedRoute (Admin Only)
│         │    ├─── Dashboard
│         │    ├─── Editor
│         │    ├─── PendingUpdates (NEW)
│         │    └─── Analytics
│         │
│         ├─── ClientRoute (Client Only) - Optional
│         │    └─── ClientDashboard (NEW)
│         │
│         └─── CustomWheel (Public)
```

## State Management

```
┌─────────────────────────────────────────────────────────────┐
│                     AuthContext State                        │
├─────────────────────────────────────────────────────────────┤
│  • authed: boolean                                          │
│  • role: 'admin' | 'client' | null                          │
│  • clientData: {                                            │
│      clientId: string                                       │
│      username: string                                       │
│      routeName: string                                      │
│      wheelId: string                                        │
│    }                                                         │
│                                                              │
│  Methods:                                                    │
│  • login(username, password) → Admin login                  │
│  • clientLogin(username, password) → Client login           │
│  • logout() → Clear session                                 │
└─────────────────────────────────────────────────────────────┘
```

## Responsive Breakpoints

```
Mobile          Tablet          Desktop         Large Desktop
< 640px         640-1024px      1024-1440px     > 1440px
│               │               │               │
├─ 1 column     ├─ 2 columns    ├─ 3 columns    ├─ 3 columns
├─ Stack form   ├─ Flex layout  ├─ Grid layout  ├─ Max width
├─ Full width   ├─ Side-by-side ├─ Enhanced     ├─ 1200px
│  buttons      │  actions      │  spacing      │  centered
└───────────────┴───────────────┴───────────────┴──────────────
```

## File Structure

```
spin-and-win-main/
│
├── backend/
│   ├── src/
│   │   ├── app.js (UPDATED)
│   │   ├── models/
│   │   │   ├── login.model.js (existing)
│   │   │   ├── wheel.model.js (existing)
│   │   │   └── pendingUpdate.model.js (NEW)
│   │   └── routes/
│   │       ├── auth.routes.js (UPDATED)
│   │       ├── client.routes.js (NEW)
│   │       ├── admin.routes.js (NEW)
│   │       └── ... (existing routes)
│   ├── server.js (UPDATED)
│   ├── .env (UPDATED)
│   └── package.json
│
├── spin-and-win/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ClientLogin.jsx (NEW)
│   │   │   ├── ClientDashboard.jsx (NEW)
│   │   │   ├── ClientDashboard.css (NEW)
│   │   │   ├── PendingUpdates.jsx (NEW)
│   │   │   ├── PendingUpdates.css (NEW)
│   │   │   ├── Login.jsx (UPDATED)
│   │   │   ├── Navbar.jsx (UPDATED)
│   │   │   └── ... (existing pages)
│   │   ├── context/
│   │   │   └── AuthContext.jsx (UPDATED)
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx (UPDATED)
│   │   │   └── ClientRoute.jsx (NEW)
│   │   └── App.js (UPDATED)
│   └── package.json
│
├── CLIENT_SYSTEM_README.md (NEW)
├── QUICK_START.md (NEW)
└── ARCHITECTURE.md (THIS FILE)
```

## Technology Stack

```
Frontend:
├── React 18.x
├── React Router DOM v6
├── CSS3 (Custom, No Framework)
└── Fetch API

Backend:
├── Node.js 14+
├── Express.js 4.x
├── Mongoose 6.x
└── CORS, dotenv

Database:
└── MongoDB Atlas (Cloud)

Development:
├── VS Code
├── npm/npx
└── Git
```

---

**This architecture ensures:**
- ✅ Complete separation of admin and client roles
- ✅ Secure authentication and authorization
- ✅ Pending updates workflow with admin approval
- ✅ Responsive design for all devices
- ✅ Scalable and maintainable codebase
- ✅ Production-ready security practices
