# Hackathon Backend - MongoDB Version

This is a Node.js backend for a mock college-level hackathon hosting platform, migrated from SQLite to MongoDB with a modular structure.

## Project Structure

```
hackathon-backend1/
├── config/
│   └── database.js          # MongoDB connection configuration
├── models/                  # Mongoose models
│   ├── User.js
│   ├── Team.js
│   ├── McqQuestion.js
│   ├── AttemptRound1.js
│   ├── ProblemRound2.js
│   ├── SubmissionRound2.js
│   ├── Shortlist.js
│   ├── Schedule.js
│   └── EventSetting.js
├── middleware/
│   └── auth.js              # Authentication middleware
├── routes/                  # API route handlers
│   ├── auth.js
│   ├── public.js
│   ├── me.js
│   ├── status.js
│   ├── round1.js
│   ├── round2.js
│   ├── certificate.js
│   ├── admin.js
│   └── debug.js
├── utils/
│   ├── helpers.js           # Utility functions
│   ├── upload.js            # File upload configuration
│   └── seed.js              # Database seeding
├── server.js                # Main server file
├── package.json
├── .env                     # Environment variables (create this)
└── API_DOCUMENTATION.md     # Complete API documentation
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory with the following:

```env
# MongoDB Connection String
MONGODB_URI=mongodb://localhost:27017/hackathon2026

# JWT Secret
JWT_SECRET=devjwt

# Server Port
PORT=4000
```

**Important:** Replace `MONGODB_URI` with your actual MongoDB connection string. Examples:
- Local MongoDB: `mongodb://localhost:27017/hackathon2026`
- MongoDB Atlas: `mongodb+srv://username:password@cluster.mongodb.net/hackathon2026`

### 3. Start the Server

```bash
npm start
```

The server will:
- Connect to MongoDB
- Seed the database with initial data (admin user, MCQ questions, problems, schedule)
- Start listening on the configured port (default: 4000)

## Default Admin Credentials

- **Email:** `admin@nits.ac.in`
- **Password:** `admin123`

## API Documentation

See `API_DOCUMENTATION.md` for complete API documentation with all endpoints and example requests for Postman.

## Key Features

- ✅ MongoDB database (migrated from SQLite)
- ✅ Modular code structure
- ✅ JWT authentication
- ✅ Round 1: MCQ questions with time windows
- ✅ Round 2: File submissions for coding problems
- ✅ Admin panel for managing teams, questions, problems, and settings
- ✅ Leaderboard with time-based locking
- ✅ Shortlist computation
- ✅ Certificate data generation

## Migration Notes

- All endpoints and request formats remain unchanged
- Database migrated from SQLite to MongoDB
- Code restructured into modular components
- All existing functionality preserved

## Development

The server uses ES6 modules and requires Node.js 20.x or higher.

## Notes

- File uploads are stored in the `uploads/` directory
- Static files (datasets) are served from `public/datasets/`
- The database is automatically seeded on first run
- All timestamps are stored in ISO format

