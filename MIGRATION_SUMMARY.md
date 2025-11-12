# Migration Summary: SQLite to MongoDB

## What Changed

### Database
- ✅ Migrated from SQLite to MongoDB
- ✅ All data models converted to Mongoose schemas
- ✅ Automatic seeding on server start

### Code Structure
- ✅ Modularized from single `server.js` file to organized structure:
  - `config/` - Database configuration
  - `models/` - Mongoose models
  - `middleware/` - Authentication middleware
  - `routes/` - API route handlers
  - `utils/` - Helper functions and utilities

### What Stayed the Same
- ✅ **All endpoint URIs unchanged**
- ✅ **All request/response formats unchanged**
- ✅ **All authentication mechanisms unchanged**
- ✅ **All business logic preserved**

## Files Created

### Configuration
- `config/database.js` - MongoDB connection

### Models (9 files)
- `models/User.js`
- `models/Team.js`
- `models/McqQuestion.js`
- `models/AttemptRound1.js`
- `models/ProblemRound2.js`
- `models/SubmissionRound2.js`
- `models/Shortlist.js`
- `models/Schedule.js`
- `models/EventSetting.js`

### Middleware
- `middleware/auth.js` - JWT authentication

### Routes (9 files)
- `routes/auth.js` - Registration and login
- `routes/public.js` - Public endpoints (server-time, event-settings, schedule, leaderboard, event-info)
- `routes/me.js` - Current user info
- `routes/status.js` - Team status
- `routes/round1.js` - Round 1 questions and submission
- `routes/round2.js` - Round 2 problems and submission
- `routes/certificate.js` - Certificate data
- `routes/admin.js` - Admin endpoints
- `routes/debug.js` - Debug endpoints

### Utilities
- `utils/helpers.js` - Helper functions (settings, time windows, etc.)
- `utils/upload.js` - File upload configuration
- `utils/seed.js` - Database seeding

### Documentation
- `README.md` - Setup instructions
- `API_DOCUMENTATION.md` - Complete API documentation with Postman examples
- `MIGRATION_SUMMARY.md` - This file

## Environment Variables

Create a `.env` file with:
```env
MONGODB_URI=mongodb://localhost:27017/hackathon2026
JWT_SECRET=devjwt
PORT=4000
```

## Next Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Update `.env` file:**
   - Add your MongoDB connection string

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Test endpoints:**
   - Use `API_DOCUMENTATION.md` for complete endpoint list and Postman examples
   - Default admin: `admin@nits.ac.in` / `admin123`

## Important Notes

- The database will be automatically seeded on first run
- All existing endpoints work exactly as before
- No changes needed to frontend code
- MongoDB ObjectIds are automatically converted to strings in JSON responses

## All Endpoints (33 total)

See `API_DOCUMENTATION.md` for detailed documentation with request/response examples.

### Public (5)
1. GET `/api/server-time`
2. GET `/api/event-settings`
3. GET `/api/schedule`
4. GET `/api/leaderboard`
5. GET `/api/event-info`

### Authentication (2)
6. POST `/api/auth/register`
7. POST `/api/auth/login`

### User (2)
8. GET `/api/me`
9. GET `/api/status`

### Round 1 (2)
10. GET `/api/round1/questions`
11. POST `/api/round1/submit`

### Round 2 (3)
12. GET `/api/round2/problems`
13. GET `/api/round2/my-submission`
14. POST `/api/round2/submit`

### Certificate (1)
15. GET `/api/certificate-data`

### Admin (17)
16. GET `/api/admin/teams`
17. DELETE `/api/admin/teams/:id`
18. GET `/api/admin/submissions`
19. GET `/api/admin/mcqs`
20. POST `/api/admin/mcqs`
21. PUT `/api/admin/mcqs/:id`
22. DELETE `/api/admin/mcqs/:id`
23. GET `/api/admin/problems`
24. POST `/api/admin/problems`
25. PUT `/api/admin/problems/:id`
26. DELETE `/api/admin/problems/:id`
27. POST `/api/admin/compute-shortlist`
28. GET `/api/admin/event-settings`
29. PUT `/api/admin/event-settings`
30. POST `/api/admin/schedule`
31. PUT `/api/admin/schedule/:id`
32. DELETE `/api/admin/schedule/:id`

### Debug (1)
33. GET `/debug-users`

