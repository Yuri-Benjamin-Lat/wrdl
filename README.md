# WRDL

WRDL is a personal, non-commercial Wordle-inspired web game with a Philippine-time Daily Wordle, memory-only Free Play, friends, streak leaderboards, and real-time Friendly Battles for two to eight players.

## Project status

Planning Phases 1–6 are complete. Production development is currently in Milestone M0: repository and environments.

## Repository structure

- `apps/web` — Next.js web application
- `packages/game-core` — planned shared, framework-independent Wordle rules
- `supabase` — version-controlled database migrations and hosted-project configuration
- `phase-*.md` — approved product, UX, design, architecture, and roadmap documents
- `wrdl-*-preview.html` — approved visual implementation references

## Local commands

Install dependencies, then run the application and quality checks from the repository root:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and replace its placeholders with values from the matching hosted Supabase project.

WRDL does not use Docker or a local Supabase stack. Backend development and integration testing use the private hosted development/staging Supabase project; production uses a separate hosted project.

Never commit `.env` files, Supabase secret/service-role keys, database exports, protected word schedules, or real user data.
