# SecureVault HR
**Employee Management System with Role-Based Access Control & Audit Security**

A full-stack MERN application that manages employee records through a multi-role access system, ensuring sensitive fields (salary, bank details) remain protected with field-level encryption, and critical operations are logged for accountability.

---

## 1. Features & SOP Modules
- **Authentication Module:** Registration/login with JWT-based session management, bcrypt password hashing, and rate-limited login attempts to prevent brute-force attacks.
- **Role-Based Access Control (RBAC):** Middleware-based route protection enforcing strict role permissions across three roles:
  - **Admin:** Full access to manage employee profiles, view decrypted sensitive fields, review audit logs, and inspect analytics.
  - **HR Manager:** Manage department employees, approve/reject leaves, but **cannot view sensitive salary/bank details** (masked).
  - **Employee:** View and update personal profile, apply for leaves, and track leave status.
- **Employee Management Module:** CRUD operations with restricted field visibility based on user role.
- **Leave Management Module:** Employee leave application flow with HR Manager approval/rejection workflows.
- **Secure Data Module:** AES-256 field-level encryption for sensitive fields (`salary`, `bankDetails`) before storing them in MongoDB.
- **Audit Log Module:** Tamper-evident, hash-chained logging of all critical actions (who, what, when, IP).
- **Analytics Dashboard:** Visual charts (department distribution, leave status breakdown, role distribution) using Chart.js.

---

## 2. Technology Stack
- **Frontend:** React.js, Tailwind CSS, Chart.js (`react-chartjs-2`), Vite
- **Backend:** Node.js, Express.js
- **Database:** MongoDB with Mongoose
- **Security:** JWT, bcryptjs, AES-256 field encryption, express-rate-limit, input sanitization

---

## 3. Demo Accounts
Password for all accounts: `Demo@2026!`

| Email | Role | Department | Description |
|---|---|---|---|
| `admin@securevault.demo` | Admin | Leadership | Full access, audit logs, decrypted salary access |
| `hr@securevault.demo` | HR Manager | Engineering | Department employee management, leave approvals, salary masked |
| `neha@securevault.demo` | Employee | Engineering | Self profile, leave application |

---

## 4. Quick Start

### Backend
```bash
cd backend
npm install
npm run seed:reset     # Seeds demo accounts and records
npm run dev            # Starts server on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev            # Starts client on http://localhost:5173
```
