# YouTube Creator Assistant

## Prerequisites
- Node.js 18+
- Google Cloud project with OAuth credentials that can access the YouTube Data API v3

## Backend Setup
1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Create a `.env` file in `backend/` (an example configuration is already provided) and set:
   ```
   PORT=4000
   FRONTEND_URL=http://localhost:5173
   GOOGLE_CLIENT_ID=31805517403-cipb6vqm74gp4ikbmoapsn9ubui8aml9.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=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
   GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback
   ```
3. Start the server:
   ```bash
   npm run dev
   ```

## Frontend Setup
1. Navigate to the frontend directory and install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Create a `.env` file in `frontend/` with the backend API base:
   ```
   VITE_API_URL=http://localhost:4000
   ```
3. Run the Vite dev server:
   ```bash
   npm run dev
   ```

## OAuth Flow
- Visiting `http://localhost:5173` displays a "Login with Google" button.
- Clicking the button redirects through the backend to Google's OAuth consent screen.
- After consenting, Google redirects to the backend callback, which exchanges the authorization code for tokens and redirects to `http://localhost:5173/auth/success` with the tokens and user info in the query string.
- Errors redirect to `http://localhost:5173/auth/error`.
