# YouTube Creator Assistant ✨

Boost your channel’s creative workflow with a single full-stack app that plans videos, responds to your community, and spins up shorts in minutes.

## Why Creators Love It
- 📊 **Analytics tab** – Track channel health, surface top-performing uploads, and monitor recent trends in one glance.
- 💬 **Comments tab** – Pull in viewer feedback, draft AI-powered replies, and queue responses before publishing.
- 🎬 **Shorts tab** – Trim long-form videos, auto-generate scripts from transcripts, and manage download/upload jobs.
- 💡 **Video Ideas tab** – Brainstorm titles, outlines, and hook ideas with tailored Gemini + OpenAI prompts.
- 🖼️ **Thumbnail helper** – Produce thumbnail concepts with Hugging Face models and iterate quickly.
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
