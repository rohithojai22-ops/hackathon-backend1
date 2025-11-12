# Hackathon Backend API Documentation

## Base URL
```
http://localhost:4000/api
```

## Authentication
Most endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Public Endpoints

### 1. Get Server Time
**GET** `/api/server-time`

**Description:** Returns the current server time in ISO format.

**Request:** None

**Response:**
```json
{
  "now_iso": "2026-01-15T10:30:00.000Z"
}
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/server-time`
- Headers: None
- Body: None

---

### 2. Get Event Settings
**GET** `/api/event-settings`

**Description:** Returns the event settings including round 1 and round 2 time windows.

**Request:** None

**Response:**
```json
{
  "round1": {
    "start_iso": "2026-01-15T09:00:00.000Z",
    "end_iso": "2026-01-15T12:00:00.000Z"
  },
  "round2": {
    "start_iso": "2026-02-07T09:00:00.000Z",
    "end_iso": "2026-02-07T18:00:00.000Z"
  },
  "server_now_iso": "2026-01-15T10:30:00.000Z"
}
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/event-settings`
- Headers: None
- Body: None

---

### 3. Get Schedule
**GET** `/api/schedule`

**Description:** Returns the hackathon schedule.

**Request:** None

**Response:**
```json
[
  {
    "_id": "...",
    "round": "Registration",
    "title": "Registration Deadline",
    "description": "Last date to register",
    "date": "2025-12-30"
  },
  {
    "_id": "...",
    "round": "Round 1",
    "title": "Online MCQ Screening",
    "description": "Aptitude + Basic Coding",
    "date": "2026-01-15"
  }
]
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/schedule`
- Headers: None
- Body: None

---

### 4. Get Leaderboard
**GET** `/api/leaderboard`

**Description:** Returns the leaderboard. Locked until Round 1 ends (unless admin).

**Request:** None (Optional: Bearer token for admin access)

**Response:**
```json
[
  {
    "team_name": "Team Alpha",
    "score": 12,
    "total": 15,
    "created_at": "2026-01-15T10:00:00.000Z"
  },
  {
    "team_name": "Team Beta",
    "score": 11,
    "total": 15,
    "created_at": "2026-01-15T10:05:00.000Z"
  }
]
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/leaderboard`
- Headers: None (or `Authorization: Bearer <admin_token>`)
- Body: None

---

### 5. Get Event Info
**GET** `/api/event-info`

**Description:** Returns event information including prizes, certificates, registration details.

**Request:** None

**Response:**
```json
{
  "prizes": {
    "first": { "amount": 50000, "desc": "Certificate of Achievement" },
    "second": { "amount": 40000, "desc": "Certificate of Achievement" },
    "third": { "amount": 30000, "desc": "Certificate of Achievement" }
  },
  "certificates": [...],
  "registration": {...},
  ...
}
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/event-info`
- Headers: None
- Body: None

---

## Authentication Endpoints

### 6. Register
**POST** `/api/auth/register`

**Description:** Register a new team.

**Request Body:**
```json
{
  "team_name": "Team Alpha",
  "email": "team@example.com",
  "password": "password123",
  "phone": "1234567890",
  "member1": "John Doe",
  "member2": "Jane Smith",
  "member3": "Bob Johnson"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Postman Example:**
- Method: POST
- URL: `http://localhost:4000/api/auth/register`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "team_name": "Team Alpha",
  "email": "team@example.com",
  "password": "password123",
  "phone": "1234567890",
  "member1": "John Doe",
  "member2": "Jane Smith",
  "member3": "Bob Johnson"
}
```

---

### 7. Login
**POST** `/api/auth/login`

**Description:** Login with email and password.

**Request Body:**
```json
{
  "email": "admin@nits.ac.in",
  "password": "admin123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "admin"
}
```

**Postman Example:**
- Method: POST
- URL: `http://localhost:4000/api/auth/login`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "email": "admin@nits.ac.in",
  "password": "admin123"
}
```

---

## User Endpoints

### 8. Get Current User
**GET** `/api/me`

**Description:** Get current user information.

**Request:** Requires Bearer token

**Response (Team):**
```json
{
  "role": "team",
  "team": {
    "_id": "...",
    "team_name": "Team Alpha",
    "phone": "1234567890",
    "member1": "John Doe",
    "member2": "Jane Smith",
    "member3": "Bob Johnson"
  }
}
```

**Response (Admin):**
```json
{
  "role": "admin",
  "email": "admin@nits.ac.in"
}
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/me`
- Headers: `Authorization: Bearer <token>`
- Body: None

---

### 9. Get Status
**GET** `/api/status`

**Description:** Get team's status including round 1 attempt, shortlist status, and time windows.

**Request:** Requires Bearer token (team)

**Response:**
```json
{
  "round1": {
    "score": 12,
    "total": 15
  },
  "shortlist": {
    "round1_qualified": 1,
    "round2_shortlisted": 0
  },
  "round1_window": {
    "start_iso": "2026-01-15T09:00:00.000Z",
    "end_iso": "2026-01-15T12:00:00.000Z",
    "server_now_iso": "2026-01-15T10:30:00.000Z"
  },
  "round2_window": {
    "start_iso": "2026-02-07T09:00:00.000Z",
    "end_iso": "2026-02-07T18:00:00.000Z",
    "server_now_iso": "2026-01-15T10:30:00.000Z"
  },
  "round1_attempted": true
}
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/status`
- Headers: `Authorization: Bearer <team_token>`
- Body: None

---

## Round 1 Endpoints

### 10. Get Round 1 Questions
**GET** `/api/round1/questions`

**Description:** Get MCQ questions for Round 1. Only available during the round window.

**Request:** Requires Bearer token (team)

**Response:**
```json
[
  {
    "id": "...",
    "question": "Time complexity of binary search?",
    "opt_a": "O(n)",
    "opt_b": "O(n log n)",
    "opt_c": "O(log n)",
    "opt_d": "O(1)"
  },
  ...
]
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/round1/questions`
- Headers: `Authorization: Bearer <team_token>`
- Body: None

---

### 11. Submit Round 1 Answers
**POST** `/api/round1/submit`

**Description:** Submit answers for Round 1 MCQ. Only available during the round window.

**Request Body:**
```json
{
  "answers": {
    "question_id_1": "a",
    "question_id_2": "b",
    "question_id_3": "c",
    ...
  }
}
```

**Response:**
```json
{
  "score": 12,
  "total": 15
}
```

**Postman Example:**
- Method: POST
- URL: `http://localhost:4000/api/round1/submit`
- Headers: 
  - `Authorization: Bearer <team_token>`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "answers": {
    "507f1f77bcf86cd799439011": "c",
    "507f1f77bcf86cd799439012": "b",
    "507f1f77bcf86cd799439013": "b"
  }
}
```

---

## Round 2 Endpoints

### 12. Get Round 2 Problems
**GET** `/api/round2/problems`

**Description:** Get problems for Round 2. Available after Round 2 starts.

**Request:** Requires Bearer token (team)

**Response:**
```json
[
  {
    "_id": "...",
    "title": "Fake News Classifier",
    "statement": "Build a text classifier to label short headlines as FAKE/REAL. Describe preprocessing and model."
  },
  ...
]
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/round2/problems`
- Headers: `Authorization: Bearer <team_token>`
- Body: None

---

### 13. Get My Round 2 Submission
**GET** `/api/round2/my-submission`

**Description:** Get the current team's Round 2 submission.

**Request:** Requires Bearer token (team)

**Response:**
```json
{
  "_id": "...",
  "team_id": "...",
  "filename": "1234567890-submission.zip",
  "created_at": "2026-02-07T10:00:00.000Z"
}
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/round2/my-submission`
- Headers: `Authorization: Bearer <team_token>`
- Body: None

---

### 14. Submit Round 2 Solution
**POST** `/api/round2/submit`

**Description:** Submit Round 2 solution file. Only available after Round 2 starts.

**Request:** Requires Bearer token (team), multipart/form-data with file

**Request Body (form-data):**
- Key: `file`
- Type: File
- Value: [Select file]

**Response:**
```json
{
  "ok": true,
  "filename": "1234567890-submission.zip"
}
```

**Postman Example:**
- Method: POST
- URL: `http://localhost:4000/api/round2/submit`
- Headers: `Authorization: Bearer <team_token>`
- Body: form-data
  - Key: `file`, Type: File, Value: [Select your submission file]

---

## Certificate Endpoint

### 15. Get Certificate Data
**GET** `/api/certificate-data`

**Description:** Get certificate data for the current team.

**Request:** Requires Bearer token (team)

**Response:**
```json
{
  "teamName": "Team Alpha",
  "score": 12,
  "total": 15,
  "qualified": true,
  "date": "2026-01-15T10:00:00.000Z"
}
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/certificate-data`
- Headers: `Authorization: Bearer <team_token>`
- Body: None

---

## Admin Endpoints

### 16. Get All Teams
**GET** `/api/admin/teams`

**Description:** Get all registered teams.

**Request:** Requires Bearer token (admin)

**Response:**
```json
[
  {
    "_id": "...",
    "team_name": "Team Alpha",
    "phone": "1234567890",
    "member1": "John Doe",
    "member2": "Jane Smith",
    "member3": "Bob Johnson"
  },
  ...
]
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/admin/teams`
- Headers: `Authorization: Bearer <admin_token>`
- Body: None

---

### 17. Delete Team
**DELETE** `/api/admin/teams/:id`

**Description:** Delete a team by ID.

**Request:** Requires Bearer token (admin)

**Response:**
```json
{
  "ok": true
}
```

**Postman Example:**
- Method: DELETE
- URL: `http://localhost:4000/api/admin/teams/507f1f77bcf86cd799439011`
- Headers: `Authorization: Bearer <admin_token>`
- Body: None

---

### 18. Get All Submissions
**GET** `/api/admin/submissions`

**Description:** Get all Round 2 submissions.

**Request:** Requires Bearer token (admin)

**Response:**
```json
[
  {
    "_id": "...",
    "team_id": "...",
    "filename": "1234567890-submission.zip",
    "created_at": "2026-02-07T10:00:00.000Z"
  },
  ...
]
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/admin/submissions`
- Headers: `Authorization: Bearer <admin_token>`
- Body: None

---

### 19. Get All MCQ Questions
**GET** `/api/admin/mcqs`

**Description:** Get all MCQ questions.

**Request:** Requires Bearer token (admin)

**Response:**
```json
[
  {
    "_id": "...",
    "question": "Time complexity of binary search?",
    "opt_a": "O(n)",
    "opt_b": "O(n log n)",
    "opt_c": "O(log n)",
    "opt_d": "O(1)",
    "correct": "c"
  },
  ...
]
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/admin/mcqs`
- Headers: `Authorization: Bearer <admin_token>`
- Body: None

---

### 20. Create MCQ Question
**POST** `/api/admin/mcqs`

**Description:** Create a new MCQ question.

**Request Body:**
```json
{
  "question": "What is 2+2?",
  "opt_a": "3",
  "opt_b": "4",
  "opt_c": "5",
  "opt_d": "6",
  "correct": "b"
}
```

**Response:**
```json
{
  "ok": true
}
```

**Postman Example:**
- Method: POST
- URL: `http://localhost:4000/api/admin/mcqs`
- Headers: 
  - `Authorization: Bearer <admin_token>`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "question": "What is 2+2?",
  "opt_a": "3",
  "opt_b": "4",
  "opt_c": "5",
  "opt_d": "6",
  "correct": "b"
}
```

---

### 21. Update MCQ Question
**PUT** `/api/admin/mcqs/:id`

**Description:** Update an existing MCQ question.

**Request Body:**
```json
{
  "question": "What is 2+2?",
  "opt_a": "3",
  "opt_b": "4",
  "opt_c": "5",
  "opt_d": "6",
  "correct": "b"
}
```

**Response:**
```json
{
  "ok": true
}
```

**Postman Example:**
- Method: PUT
- URL: `http://localhost:4000/api/admin/mcqs/507f1f77bcf86cd799439011`
- Headers: 
  - `Authorization: Bearer <admin_token>`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "question": "What is 2+2?",
  "opt_a": "3",
  "opt_b": "4",
  "opt_c": "5",
  "opt_d": "6",
  "correct": "b"
}
```

---

### 22. Delete MCQ Question
**DELETE** `/api/admin/mcqs/:id`

**Description:** Delete an MCQ question.

**Request:** Requires Bearer token (admin)

**Response:**
```json
{
  "ok": true
}
```

**Postman Example:**
- Method: DELETE
- URL: `http://localhost:4000/api/admin/mcqs/507f1f77bcf86cd799439011`
- Headers: `Authorization: Bearer <admin_token>`
- Body: None

---

### 23. Get All Problems
**GET** `/api/admin/problems`

**Description:** Get all Round 2 problems.

**Request:** Requires Bearer token (admin)

**Response:**
```json
[
  {
    "_id": "...",
    "title": "Fake News Classifier",
    "statement": "Build a text classifier..."
  },
  ...
]
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/admin/problems`
- Headers: `Authorization: Bearer <admin_token>`
- Body: None

---

### 24. Create Problem
**POST** `/api/admin/problems`

**Description:** Create a new Round 2 problem.

**Request Body:**
```json
{
  "title": "New Problem",
  "statement": "Problem description here..."
}
```

**Response:**
```json
{
  "ok": true
}
```

**Postman Example:**
- Method: POST
- URL: `http://localhost:4000/api/admin/problems`
- Headers: 
  - `Authorization: Bearer <admin_token>`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "title": "New Problem",
  "statement": "Problem description here..."
}
```

---

### 25. Update Problem
**PUT** `/api/admin/problems/:id`

**Description:** Update an existing Round 2 problem.

**Request Body:**
```json
{
  "title": "Updated Problem",
  "statement": "Updated problem description..."
}
```

**Response:**
```json
{
  "ok": true
}
```

**Postman Example:**
- Method: PUT
- URL: `http://localhost:4000/api/admin/problems/507f1f77bcf86cd799439011`
- Headers: 
  - `Authorization: Bearer <admin_token>`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "title": "Updated Problem",
  "statement": "Updated problem description..."
}
```

---

### 26. Delete Problem
**DELETE** `/api/admin/problems/:id`

**Description:** Delete a Round 2 problem.

**Request:** Requires Bearer token (admin)

**Response:**
```json
{
  "ok": true
}
```

**Postman Example:**
- Method: DELETE
- URL: `http://localhost:4000/api/admin/problems/507f1f77bcf86cd799439011`
- Headers: `Authorization: Bearer <admin_token>`
- Body: None

---

### 27. Compute Shortlist
**POST** `/api/admin/compute-shortlist`

**Description:** Compute and update the shortlist based on Round 1 scores.

**Request:** Requires Bearer token (admin)

**Response:**
```json
{
  "ok": true,
  "message": "Shortlist computed"
}
```

**Postman Example:**
- Method: POST
- URL: `http://localhost:4000/api/admin/compute-shortlist`
- Headers: `Authorization: Bearer <admin_token>`
- Body: None

---

### 28. Get Event Settings
**GET** `/api/admin/event-settings`

**Description:** Get all event settings.

**Request:** Requires Bearer token (admin)

**Response:**
```json
{
  "round1_start_iso": "2026-01-15T09:00:00.000Z",
  "round1_end_iso": "2026-01-15T12:00:00.000Z",
  "round2_start_iso": "2026-02-07T09:00:00.000Z",
  "round2_end_iso": "2026-02-07T18:00:00.000Z"
}
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/api/admin/event-settings`
- Headers: `Authorization: Bearer <admin_token>`
- Body: None

---

### 29. Update Event Settings
**PUT** `/api/admin/event-settings`

**Description:** Update event settings (time windows).

**Request Body:**
```json
{
  "round1_start_iso": "2026-01-15T09:00:00.000Z",
  "round1_end_iso": "2026-01-15T12:00:00.000Z",
  "round2_start_iso": "2026-02-07T09:00:00.000Z",
  "round2_end_iso": "2026-02-07T18:00:00.000Z"
}
```

**Response:**
```json
{
  "ok": true,
  "round1": {
    "start_iso": "2026-01-15T09:00:00.000Z",
    "end_iso": "2026-01-15T12:00:00.000Z"
  },
  "round2": {
    "start_iso": "2026-02-07T09:00:00.000Z",
    "end_iso": "2026-02-07T18:00:00.000Z"
  },
  "server_now_iso": "2026-01-15T10:30:00.000Z"
}
```

**Postman Example:**
- Method: PUT
- URL: `http://localhost:4000/api/admin/event-settings`
- Headers: 
  - `Authorization: Bearer <admin_token>`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "round1_start_iso": "2026-01-15T09:00:00.000Z",
  "round1_end_iso": "2026-01-15T12:00:00.000Z",
  "round2_start_iso": "2026-02-07T09:00:00.000Z",
  "round2_end_iso": "2026-02-07T18:00:00.000Z"
}
```

---

### 30. Create Schedule Item
**POST** `/api/admin/schedule`

**Description:** Create a new schedule item.

**Request Body:**
```json
{
  "round": "Round 1",
  "title": "Online MCQ Screening",
  "description": "Aptitude + Basic Coding",
  "date": "2026-01-15"
}
```

**Response:**
```json
{
  "ok": true
}
```

**Postman Example:**
- Method: POST
- URL: `http://localhost:4000/api/admin/schedule`
- Headers: 
  - `Authorization: Bearer <admin_token>`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "round": "Round 1",
  "title": "Online MCQ Screening",
  "description": "Aptitude + Basic Coding",
  "date": "2026-01-15"
}
```

---

### 31. Update Schedule Item
**PUT** `/api/admin/schedule/:id`

**Description:** Update an existing schedule item.

**Request Body:**
```json
{
  "round": "Round 1",
  "title": "Updated Title",
  "description": "Updated description",
  "date": "2026-01-16"
}
```

**Response:**
```json
{
  "ok": true
}
```

**Postman Example:**
- Method: PUT
- URL: `http://localhost:4000/api/admin/schedule/507f1f77bcf86cd799439011`
- Headers: 
  - `Authorization: Bearer <admin_token>`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "round": "Round 1",
  "title": "Updated Title",
  "description": "Updated description",
  "date": "2026-01-16"
}
```

---

### 32. Delete Schedule Item
**DELETE** `/api/admin/schedule/:id`

**Description:** Delete a schedule item.

**Request:** Requires Bearer token (admin)

**Response:**
```json
{
  "ok": true
}
```

**Postman Example:**
- Method: DELETE
- URL: `http://localhost:4000/api/admin/schedule/507f1f77bcf86cd799439011`
- Headers: `Authorization: Bearer <admin_token>`
- Body: None

---

## Debug Endpoint

### 33. Debug Users
**GET** `/debug-users`

**Description:** Get all users (for debugging).

**Request:** None

**Response:**
```json
[
  {
    "_id": "...",
    "email": "admin@nits.ac.in",
    "role": "admin",
    "team_id": null
  },
  ...
]
```

**Postman Example:**
- Method: GET
- URL: `http://localhost:4000/debug-users`
- Headers: None
- Body: None

---

## Notes

1. **Default Admin Credentials:**
   - Email: `admin@nits.ac.in`
   - Password: `admin123`

2. **Token Format:**
   - All protected endpoints require: `Authorization: Bearer <token>`
   - Token is obtained from `/api/auth/login` or `/api/auth/register`

3. **File Upload:**
   - Round 2 submission uses `multipart/form-data`
   - Use form-data in Postman with key `file` and type `File`

4. **Object IDs:**
   - MongoDB ObjectIds are returned as strings in JSON responses
   - Use the `_id` field for references in PUT/DELETE requests

5. **Time Windows:**
   - Round 1 questions/submit are only available during the configured time window
   - Round 2 problems/submit are available after Round 2 starts
   - Leaderboard is locked until Round 1 ends (unless admin)

