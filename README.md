#  Job Portal 

A backend system for a job portal where recruiters can post jobs and applicants can apply with resume upload and track their applications.

---

##  Tech Stack

- Node.js
- Express.js
- MySQL
- JWT Authentication
- Multer (File Uploads)

---

## Features

###  Applicant
- Signup/Login
- Upload Resume (PDF)
- View Jobs
- Apply to Jobs
- Track Application Status
- Save Jobs

### Recruiter
- Signup/Login
- Post Jobs
- View Applications
- Accept / Reject / Shortlist Applicants

---

##  Authentication

- JWT-based authentication
- Role-based access:
  - Applicant
  - Recruiter

---

##  API Endpoints

###  Auth
- `POST /auth/signup`
- `POST /auth/login`

---

###  Jobs
- `GET /api/jobs`
- `POST /api/jobs` (Recruiter)

---

###  Applications
- `POST /api/jobs/:id/applications` (Apply)
- `GET /api/applications` (Recruiter)
- `GET /api/my-applications` (Applicant)
- `PUT /api/applications/:id` (Update status)

---

###  Uploads
- `POST /upload/resume`
- `POST /upload/profile`

---

###  Saved Jobs
- `POST /api/jobs/:id/save`
- `GET /api/saved-jobs`

---