# SecureVault HR - Backend

Employee Management System with Role-Based Access Control (RBAC), built with Node.js, Express, and MongoDB.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your actual values:
   - `MONGO_URI` - your MongoDB Atlas connection string
   - `JWT_SECRET` - any long random string
   - `AES_SECRET_KEY` - any 32-character string, used to encrypt salary/bank details
3. Run the server:
   - `npm run dev` (auto-restarts on changes, uses nodemon)
   - or `npm start`

## Roles

- **admin** - full access: manage employees, view/edit sensitive fields (salary, bank details), approve leaves
- **hr_manager** - can view/edit employee basic info, approve/reject leaves, cannot see salary/bank details
- **employee** - can only view/update their own profile and apply for leave

The first user you register should be made an `admin` manually (see "Creating the first Admin" below), since new registrations default to `employee`.

## API Endpoints

### Auth
- `POST /api/auth/register` - body: `{ name, email, password, role, department }`
- `POST /api/auth/login` - body: `{ email, password }` (rate-limited: 5 attempts / 15 min)

All routes below require header: `Authorization: Bearer <token>`

### Employees
- `GET /api/employees/me` - own profile (any role)
- `GET /api/employees` - all employees (admin, hr_manager only)
- `POST /api/employees` - create employee (admin only)
- `PUT /api/employees/:id` - update employee (admin, hr_manager; only admin can edit salary/bankDetails)
- `DELETE /api/employees/:id` - delete employee (admin only)

### Leaves
- `POST /api/leaves` - apply for leave (any logged-in user) - body: `{ startDate, endDate, reason }`
- `GET /api/leaves/me` - own leave history
- `GET /api/leaves` - all leave requests (admin, hr_manager)
- `PUT /api/leaves/:id/review` - approve/reject (admin, hr_manager) - body: `{ status: "approved" | "rejected" }`

### Audit Logs
- `GET /api/audit-logs` - last 200 audit log entries, newest first (admin only)

### Analytics
- `GET /api/analytics/summary` - department distribution, leave status breakdown, role breakdown (admin, hr_manager)

## Creating the first Admin

Since registration defaults everyone to `employee`, after registering your first user, open MongoDB Atlas
(Browse Collections -> users collection), find that user, and manually change `role` to `"admin"`.
After that, the admin can create more users with any role via `POST /api/employees`.

## Security Features Implemented

1. Password hashing with bcrypt
2. JWT-based authentication (7-day expiry)
3. Role-based access control via middleware (`protect`, `authorize`)
4. Field-level AES-256 encryption for salary and bank details
5. Audit logging of create/update/delete/leave-review actions (see `AuditLog` model), viewable via `/api/audit-logs`
6. Rate limiting on login (brute-force protection)
7. Input validation/sanitization via express-validator
