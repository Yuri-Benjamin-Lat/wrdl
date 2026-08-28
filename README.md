# WRDL

WRDL is a personal, non-commercial Wordle-inspired web game with a Philippine-time Daily Wordle, memory-only Free Play, friends, streak leaderboards, and real-time Friendly Battles for two to eight players.

## Project status

Planning Phases 1–6 and development Milestones M0–M1 are complete. The next
development target is Milestone M2: authentication, profiles, and settings.

## Repository structure

- `apps/web` — Next.js web application
- `packages/game-core` — planned shared, framework-independent Wordle rules
- `supabase` — version-controlled database migrations and hosted-project configuration
- `phase-*.md` — approved product, UX, design, architecture, and roadmap documents
- `wrdl-*-preview.html` — approved visual implementation references

The real M1 interface currently includes Home (`/`), Sign In (`/sign-in`), and
Username Setup (`/username-setup`). A development-only component gallery is
available at `/dev/components` while `pnpm dev` is running and returns Not Found
in production builds.

## Local commands

Install dependencies, then run the application and quality checks from Windows
PowerShell at the repository root:

```powershell
pnpm install
pnpm dev
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm secrets:check
```

Copy `apps/web/.env.development.example` to `apps/web/.env.local` and replace
its placeholders with the browser-safe project URL and publishable key from the
authorized hosted development/staging Supabase project. Then verify the remote
connection:

```powershell
pnpm backend:check
```

The production template is separate at `apps/web/.env.production.example`.
Never place a Supabase secret or service-role key in a `NEXT_PUBLIC_` variable.

WRDL uses a Windows-native development workflow: Windows, PowerShell, Node.js, pnpm, and browser-based cloud services. Docker, Ubuntu, WSL, Linux development environments, and a local Supabase stack are prohibited. Backend development and integration testing use the private hosted development/staging Supabase project; production uses a separate hosted project. CI also runs on Windows.

Never commit `.env` files, Supabase secret/service-role keys, database exports, protected word schedules, or real user data.
