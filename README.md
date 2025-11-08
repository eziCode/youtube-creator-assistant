# YouTube Creator Assistant

YouTube Creator Assistant is a full-stack toolkit that helps YouTube channels plan, produce, and optimize content. It combines an Express + MongoDB backend with a Vite/React frontend to deliver analytics dashboards, AI-assisted ideation, Shorts generation workflows, and bulk comment replies powered by Google and OpenAI APIs.

## Highlights
- Analytics dashboard – pulls channel and per-video metrics via the YouTube Analytics API, with custom date ranges and session-scoped refresh tokens.
- Comment assistant – retrieves recent video comments, drafts tailored replies with OpenAI, and can post them back to YouTube after review.
- Shorts workflow – downloads source videos, trims clips with ffmpeg, generates script ideas from transcripts, and tracks progress with an in-memory job manager.
- Ideation + thumbnails – benchmarks channel videos against trending topics, generates scripts with OpenAI, and creates thumbnail drafts through Hugging Face image models.
- Session-aware OAuth – Google OAuth 2.0 sign-in stores channel metadata and tokens inside Mongo-backed sessions to support subsequent API calls.

## Tech Stack
- Backend: Node.js 18, Express 5, MongoDB (Mongoose), Google APIs SDK, OpenAI SDK, Hugging Face Inference, ffmpeg/ytdl-core.
- Frontend: React 19, Vite 6, TailwindCSS 4, Google Generative AI SDK.

## Prerequisites
- Node.js 18+ and npm.
- MongoDB instance (local or hosted).
- Google Cloud project with OAuth 2.0 web credentials and the YouTube Data + Analytics APIs enabled.
- OpenAI API key (for comment responses and ideation).
- Hugging Face Inference token (for thumbnail creation; optional if you disable that step).
- ffmpeg available on the host (binary path configurable via `FFMPEG_PATH`).
- MongoDB storage sized to accommodate temporary Shorts source videos (GridFS is used to store in-progress downloads).

## Environment Variables

Create a `.env` inside `backend/` containing at least the required variables below.

| Key | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | `4000` | HTTP port for the Express server. |
| `NODE_ENV` | No | `development` | Enables production cookie settings when set to `production`. |
| `FRONTEND_URL` | Yes | `http://localhost:5173` | Used by CORS and OAuth redirects back to the client. |
| `MONGODB_URI` | Yes | – | Connection string for MongoDB. |
| `MONGODB_DB_NAME` | No | – | Override database name when using a shared cluster. |
| `SESSION_SECRET` | Yes | – | Secret for signing session cookies. |
| `SESSION_COOKIE_NAME` | No | `yca.sid` | Custom cookie name for Express sessions. |
| `SESSION_COLLECTION_NAME` | No | `sessions` | Mongo collection to persist sessions. |
| `SESSION_TTL_SECONDS` | No | `1209600` | Session persistence window (14 days). |
| `GOOGLE_CLIENT_ID` | Yes | – | OAuth client ID from Google Cloud. |
| `GOOGLE_CLIENT_SECRET` | Yes | – | OAuth client secret. |
| `GOOGLE_REDIRECT_URI` | Yes | – | Must match `/auth/google/callback` (e.g. `http://localhost:4000/auth/google/callback`). |
| `OPENAI_API_KEY` | Yes | – | Required for OpenAI completions. |
| `OPENAI_CHAT_MODEL` | No | `gpt-4.1-nano` | Overrides the default chat model used for comment replies. |
| `YOUTUBE_API_KEY` | Yes | – | Used for read-only YouTube Data API calls (comments, dashboards). |
| `HF_API_KEY` | Conditionally | – | Required when generating thumbnails via Hugging Face. |
| `FFMPEG_PATH` | No | – | Absolute path to a system ffmpeg binary (falls back to bundled installer if omitted). |
| `CLIENT_ID` | Conditionally | – | Legacy OAuth client ID for the `/generate` route (set only if you rely on that endpoint). |
| `CLIENT_SECRET` | Conditionally | – | Legacy OAuth client secret for the `/generate` route. |

Create `frontend/.env` with:

| Key | Required | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_URL` | Yes | `http://localhost:4000` | Base URL for API requests from the Vite dev server. |

## Quick Start
```bash
# Install dependencies
cd /Users/ezraakresh/Documents/youtube-creator-assistant/backend
npm install

cd /Users/ezraakresh/Documents/youtube-creator-assistant/frontend
npm install

# Backend environment variables (backend/.env)
cat <<'EOF' > /Users/ezraakresh/Documents/youtube-creator-assistant/backend/.env
PORT=4000
FRONTEND_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/yca
SESSION_SECRET=replace-with-strong-secret
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback
OPENAI_API_KEY=replace-with-openai-key
YOUTUBE_API_KEY=replace-with-youtube-data-api-key
HF_API_KEY=optional-huggingface-token
EOF

# Frontend environment variables (frontend/.env)
echo "VITE_API_URL=http://localhost:4000" > /Users/ezraakresh/Documents/youtube-creator-assistant/frontend/.env
```

### Run the stack
In two terminals:

1. **Backend**
   ```bash
   cd /Users/ezraakresh/Documents/youtube-creator-assistant/backend
   npm run dev
   ```
   The server listens on `http://localhost:4000` and exposes routes under `/auth`, `/generate`, `/dashboard`, `/comments`, and `/shorts`.

2. **Frontend**
   ```bash
   cd /Users/ezraakresh/Documents/youtube-creator-assistant/frontend
   npm run dev
   ```
   Vite serves the React app on `http://localhost:5173`. On first load, click **Login with Google** to complete the OAuth flow and create a session.

## Development Notes
- Sessions persist in MongoDB using `connect-mongo`; TTL indexes are created automatically on first boot.
- Shorts downloads are saved to MongoDB GridFS. Pass `purge=true` to `DELETE /shorts/download/:id` (triggered automatically when you leave the Shorts view) to remove the original video once you are finished.
- If you install a system-level ffmpeg, set `FFMPEG_PATH` to avoid falling back to the bundled binary.
- The backend currently has no automated tests (`npm test` exits with code 1); add targeted tests before major refactors.
- The `/generate` route leverages experimental LLM + thumbnail flows and expects the legacy `CLIENT_ID/CLIENT_SECRET`. Leave them unset if you do not use that endpoint.

## OAuth Flow
- Visiting `http://localhost:5173` shows the Google login button.
- The frontend redirects to `/auth/google`, which forwards to Google's consent page with the scopes defined in `backend/src/routes/auth.js`.
- After consent, Google calls `GOOGLE_REDIRECT_URI`, the backend exchanges the authorization code for tokens, stores user + channel metadata in MongoDB, and redirects to `${FRONTEND_URL}/auth/success`.
- Errors redirect to `${FRONTEND_URL}/auth/error` with a serialized message.

## Troubleshooting
- **401 responses** – ensure the session cookie is present and MongoDB connection succeeded; check for missing tokens in the `users` collection.
- **Missing captions for Shorts generation** – only videos with published captions (manual or auto-generated) are supported; review backend logs for details.
- **Thumbnail generation failures** – verify `HF_API_KEY` has access to `runwayml/stable-diffusion-v1-5` and that the Hugging Face Inference API is enabled.
- **Quota errors** – confirm that both YouTube Data API and YouTube Analytics API are enabled and that the authenticated channel granted the required scopes.
