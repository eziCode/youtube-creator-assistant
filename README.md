# YouTube Creator Assistant ✨

Boost your channel’s creative workflow with a single full-stack app that plans videos, responds to your community, and spins up shorts in minutes.

## Why Creators Love It
- 📊 **Live analytics hub** – Track channel health, recent uploads, and deep-dive metrics without leaving the app.
- 💬 **Comment copilot** – Pull in viewer comments, draft AI-assisted replies, and queue them for publishing in batches.
- 💡 **Video idea generator** – Brainstorm titles, scripts, and talking points with Google Gemini and OpenAI prompts tailored to your niche.
- 🎬 **Shorts studio** – Ingest long-form videos, trim highlights, generate scripts, and manage in-progress jobs all in one tab.
- 🖼️ **Thumbnail spark** – Produce thumbnail concepts with Hugging Face models and swap between multiple drafts instantly.
- 🔐 **Google sign-in ready** – OAuth keeps tokens fresh so every request to YouTube’s Data & Analytics APIs just works.

## What’s Under the Hood
- Frontend: React + Vite + Tailwind for a snappy dashboard experience.
- Backend: Express + MongoDB with Google, OpenAI, and Hugging Face integrations.
- Automation: ffmpeg and ytdl-core handle downloads, trims, and uploads behind the scenes.

## Quick Start
1. Clone the repo and run `npm install` inside both `backend/` and `frontend/`.
2. Add `.env` files with your YouTube, Google OAuth, OpenAI, and (optionally) Hugging Face keys.
3. Spin up the dev servers with `npm run dev` in each folder and log in with Google.

## Roadmap & Ideas
- 🤖 Smarter comment tone presets
- 📅 Content calendar view
- 🔔 Notification digests for new trends

Questions or ideas? Open an issue or start a discussion—happy creating! 🚀
