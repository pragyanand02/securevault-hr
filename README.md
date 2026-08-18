# SecureVault HR
### Employee Management System with Role-Based Access Control & Audit Security

SecureVault HR is a full-stack MERN (MongoDB, Express.js, React.js, Node.js) web application designed to solve common access control and data protection shortcomings in enterprise HR systems. It implements strict Role-Based Access Control (RBAC), field-level AES-256 encryption for sensitive employee data (salary and bank account details), comprehensive audit trail logging, and protection against common web vulnerabilities (XSS, NoSQL injection, brute force).

---

## 🌟 Key Features

1. **Role-Based Access Control (RBAC)**:
   - **Admin**: Complete system overview, full CRUD operations on employee records, decryption privileges for sensitive financial data, leave reviews, and access to security audit trails.
   - **HR Manager**: Employee directory management and leave approvals with financial fields masked/omitted.
   - **Employee**: Dedicated portal to view and edit personal profiles, apply for leaves, and track application status.

2. **Security & Field-Level AES-256 Encryption**:
   - Sensitive fields (`salary`, `bankDetails`) are encrypted at the field level using `AES-256-CBC` prior to database storage.
   - Decryption keys are isolated to authorized administrator requests.

3. **Immutable Security Audit Trail**:
   - Comprehensive logging of critical lifecycle actions (`CREATE_EMPLOYEE`, `UPDATE_EMPLOYEE`, `DELETE_EMPLOYEE`, `APPLY_LEAVE`, `LEAVE_APPROVED`, `LEAVE_REJECTED`, `UPDATE_PROFILE`, `CANCEL_LEAVE`).
   - Search and category filters for audit inspection.

4. **Web Vulnerability Mitigations**:
   - **NoSQL Injection Sanitization**: Strips dangerous MongoDB operator keys (`$gt`, `$where`, etc.).
   - **Rate Limiting**: Defends against brute-force login attempts using `express-rate-limit`.
   - **Input Validation**: Request validation via `express-validator`.
   - **Password Security**: Passwords salted and hashed with `bcryptjs`.

5. **Analytics Dashboard**:
   - Visual charts powered by Chart.js (Department Distribution, Leave Status Breakdown, and User Role Breakdown).

---

## 🛠️ Technology Stack

- **Frontend**: React.js, Tailwind CSS, Chart.js / `react-chartjs-2`, Vite, React Router v7
- **Backend**: Node.js, Express.js, Mongoose, JSON Web Tokens (JWT), `bcryptjs`, `crypto` (AES-256)
- **Database**: MongoDB Atlas

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas account or local MongoDB instance

---

### Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRES_IN=7d
   AES_SECRET_KEY=your_32_character_aes_secret_key
   ```
4. Start the backend server:
   ```bash
   npm run dev
   ```

---

### Frontend Setup

1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Access the application in your browser at `http://localhost:5173`.

---

## 🔒 API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Public employee registration
- `POST /api/auth/login` — Rate-limited authentication

### Employees (`/api/employees`)
- `GET /api/employees/me` — Authenticated user's profile
- `PUT /api/employees/me` — Employee self-profile update
- `GET /api/employees` — List all employees (*Admin, HR Manager*)
- `POST /api/employees` — Create new employee record (*Admin only*)
- `PUT /api/employees/:id` — Update employee record (*Admin, HR Manager*)
- `DELETE /api/employees/:id` — Delete employee record (*Admin only*)

### Leaves (`/api/leaves`)
- `POST /api/leaves` — Submit leave application
- `GET /api/leaves/me` — View personal leave history
- `DELETE /api/leaves/:id` — Cancel pending leave application
- `GET /api/leaves` — View all leave applications (*Admin, HR Manager*)
- `PUT /api/leaves/:id/review` — Approve or reject leave request (*Admin, HR Manager*)

### Audit Logs (`/api/audit-logs`)
- `GET /api/audit-logs` — Fetch system audit records (*Admin only*)

### Analytics (`/api/analytics`)
- `GET /api/analytics/summary` — Aggregate department, role, and leave statistics (*Admin, HR Manager*)

---

## 📄 License
Academic & Educational Project — National Institute of Technology (NIT), Raipur.
