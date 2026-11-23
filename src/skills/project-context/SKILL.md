---
name: flowdeck-frontend-context
description: Project context and conventions for the Flowdeck React frontend
---

# Flowdeck Frontend Project Skill

## Purpose

Build and maintain the Flowdeck project-management web application. The frontend is a React 19, TypeScript, and Vite single-page application.

## Project locations

- Application entry: `src/main.tsx`
- Root routing/application state: `src/App.tsx`
- Authentication: `src/auth/`
- Shared layout: `src/components/layout/`
- Shared UI: `src/components/ui/`
- Feature modules: `src/features/`
- API request utilities: `src/features/notifications/api.ts`
- Theme and styles: `src/theme.ts` and `src/styles/`
- Unit tests: `tests/unit/`

## Commands

- Install: `npm install`
- Development server: `npm run dev`
- Production build: `npm run build`
- Preview build: `npm run preview`

The frontend runs at `http://localhost:5173`. It expects the backend at `http://localhost:3000/api` unless `VITE_API_URL` is configured.

## Architecture conventions

- Use feature-first organization under `src/features/`.
- Use React function components and hooks.
- Keep API access in the feature/API utility layer rather than in presentation components.
- Use lazy loading and `Suspense` for large feature routes.
- Preserve route behavior and browser history navigation.
- Reuse components in `src/components/` and icons from `src/lib/icons.tsx`.
- Keep styles consistent with the existing design tokens and CSS files.

## Authentication behavior

The application supports database/password sessions and optional Auth0 configuration.

- Password sign-in endpoint: `POST /api/session/login`
- Password sign-out endpoint: `POST /api/session/logout`
- Session status endpoint: `GET /api/session`
- Password change endpoint: `PATCH /api/session/password`
- Password authentication is enabled when `DATABASE_AUTH_ENABLED=true` in the backend.
- Auth0 settings use `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, and optionally `VITE_AUTH0_DB_CONNECTION`.

After logout, users should be sent to `/login`. After a password change, users should be sent back to `/login` and required to sign in again.

## Development rules

- Do not add sample users or dummy dashboard content to source code.
- Use the existing empty workspace database for local testing.
- Maintain responsive behavior and accessibility labels.
- Run a build after significant changes.
- Do not expose passwords or authentication secrets in frontend code.
