# SecureVault HR - Frontend

React + Tailwind frontend for the SecureVault HR backend.

## Setup

1. `npm install`
2. Make sure the backend is running on `http://localhost:5000` (see `src/api/axios.js` if you need to change this URL)
3. `npm run dev`
4. Open the URL shown in the terminal (usually `http://localhost:5173`)

## How it works

- **Login page** - logs in against `/api/auth/login`, stores the JWT token + user info in `localStorage`
- **Navbar** - shows different links depending on your role (Employees tab only shows for admin/hr_manager)
- **Dashboard** - quick stats overview, plus (for admin/hr_manager) a department-wise employee bar chart and a leave-status doughnut chart, powered by Chart.js
- **Employees page** - list all employees (admin/hr_manager), create new employee (admin only), edit, delete (admin only). Salary/bank details fields only appear for admin.
- **Leaves page** - employees apply for leave; admin/hr_manager see all requests and can approve/reject
- **Audit Log page** (admin only) - shows the last 200 sensitive actions (who did what, when)
- **Profile page** - shows your own details

## Test login

Use the admin account you created earlier via Postman (the one you manually set `role: "admin"` for in MongoDB Atlas).

## Notes

- All API calls automatically attach the JWT token via `src/api/axios.js` (axios interceptor) - you don't need to set headers manually anywhere else.
- `ProtectedRoute` component (`src/components/ProtectedRoute.jsx`) redirects to `/login` if not logged in, and redirects to `/dashboard` if a logged-in user tries to access a page their role isn't allowed to see (this is frontend-only convenience - the backend RBAC middleware is still the real security boundary).
