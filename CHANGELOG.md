# Changelog

All notable changes to the AI Factory Platform are documented here.

Format follows the [platform versioning policy](docs/project-policies/platform-versioning-policy.md).
Versions follow semantic versioning: `vMAJOR.MINOR.PATCH`

---

## v1.5.0 — 2026-06-27

### Added

- `templates/app-react-native/` — Full React Native + TypeScript template following strict separation of concerns
  - `src/navigation/` — Root, App, and Auth stack navigators (React Navigation)
  - `src/screens/` — LoginScreen, HomeScreen, UserListScreen, UserDetailScreen (layout + composition only)
  - `src/components/` — LoadingSpinner, ErrorMessage, UserCard, UserDetail (pure UI)
  - `src/hooks/` — useAuth, useUsers, useUser (logic and state only, no JSX)
  - `src/services/` — apiClient (Axios + interceptors), authService, userService (API calls only)
  - `src/constants/` — api.ts, routes.ts, errors.ts (no hardcoded values)
  - `src/config/index.ts` — Single config layer wrapping `react-native-config` (never import Config directly)
  - `src/types/` — User.ts, Auth.ts (TypeScript domain types)
  - `src/utils/storage.ts` — AsyncStorage wrapper (never use AsyncStorage directly)
  - `src/utils/logger.ts` — Centralised logger with debug suppression in production
  - `tests/userService.test.ts` — Unit tests demonstrating mock pattern for services
  - `scripts/validate-env.js` — CI script validating that env vars are accessed via config layer only
  - `Dockerfile` — CI/test runner image (type check + lint + Jest)
  - `.dockerignore`, `.eslintrc.js` — Docker and ESLint configuration
  - `.env.example`, `.gitignore`, `README.md`, `app.json`, `package.json`, `tsconfig.json`, `babel.config.js`
- `CLAUDE.md` — Claude Code governance rules file (mirrors `.cursor/rules.md`) covering all stacks: Backend Python, Backend Node, React, React Native, Flutter

### Changed

- `.cursor/rules.md` — Added `REACT NATIVE (app-react-native) — STRICT SEPARATION` section covering navigation, screens, components, hooks, services, config, storage, and constants rules

---

## v1.4.0 — 2026-03-13

### Added

- `templates/app-flutter/` — Flutter application template following Clean Architecture
  - `lib/features/auth/` — Auth feature with `data/`, `domain/`, `presentation/` layers
  - `lib/features/home/` — Home feature scaffolded with `data/`, `domain/`, `presentation/` placeholders
  - `lib/core/config/app_config.dart` — Single environment config entry point (never access `dotenv.env` directly)
  - `lib/core/config/app_router.dart` — go_router routing setup
  - `lib/core/network/api_client.dart` — Dio HTTP client (never create Dio instances in features)
  - `lib/core/services/base_service.dart` — Base service class
  - `lib/core/constants/` — api_constants.dart, app_constants.dart
  - `lib/core/utils/logger.dart` — Centralised logger
  - `lib/shared/widgets/` — app_error_widget.dart, loading_widget.dart
  - `lib/shared/themes/app_theme.dart` — Light and dark theme definitions
  - `test/features/auth/auth_repository_test.dart` — Unit tests with mocktail
  - `pubspec.yaml` — flutter_riverpod, dio, flutter_dotenv, go_router, hive_flutter
  - `analysis_options.yaml` — Flutter lint rules
  - `.env.example`, `.gitignore`, `README.md`

### Changed

- `.cursor/rules.md` — Added `FLUTTER (app-flutter) — CLEAN ARCHITECTURE` section

---

## v1.3.0 — 2026-02-24

### Changed

- `platform/version.json` — Version metadata updated to reflect v1.3.0 release

---

## v1.2.0 — 2026-02-24

### Added

- `templates/backend-node/Dockerfile` — Multi-stage Node.js build and production runtime image
- `templates/backend-node/.dockerignore`
- `templates/backend-python/Dockerfile` — Python (FastAPI) single-stage production image
- `templates/backend-python/.dockerignore`
- `templates/frontend-react/Dockerfile` — Two-stage React build + Nginx SPA server image
- `templates/frontend-react/.dockerignore`
- `templates/frontend-react/src/layout/` — MainLayout component (shared app shell), `index.ts` re-export, `README.md` explaining layout role and usage

### Changed

- `templates/backend-node/.eslintrc.js` — Enhanced ESLint rules; updated logger method signatures
- `templates/frontend-react/src/routes/index.tsx` — Integrated MainLayout as parent route wrapper
- `.cursor/rules.md` — Updated to explicitly allow `layout/` folder under `src/`; reduced context window footprint
- `.github/workflows/architecture-check.yml` — Refactored architecture validation step
- `templates/backend-node/src/` — Refactored user service instantiation; registered repositories via dependency injection

---

## v1.1.0 — 2026-02-14

### Added

- `docs/project-policies/platform-versioning-policy.md` — Defines versioning rules, tagging policy, upgrade lifecycle, and prohibited practices
- `docs/project-policies/ENFORCEMENT_GUIDE.md` — Documents the 5-layer enforcement system (Cursor config, prompt ritual, CI/CD, PR checklist, AI review)
- `platform/version.json` — Machine-readable platform version and release metadata

### Changed

- `docs/` — Restructured project documentation into `project-policies/` and `project-setup/` subdirectories

---

## v1.0.0 — 2026-02-14

### Added

- Initial stable platform release
- `templates/backend-node/` — Node.js + TypeScript backend template
  - Strict layering: Routes → Controllers → Services → Repositories → Models
  - `src/config/index.ts` — Environment config layer (Zod-validated)
  - `src/constants/` — api.ts, errors.ts, roles.ts, index.ts
  - `src/middleware/errorHandler.ts`, `src/utils/logger.ts`, `src/utils/errors.ts`
  - `src/dependencies/` — Dependency injection composition root
  - `tests/userService.test.ts` — Unit test example
  - `scripts/validate-env.js` — Environment variable architecture validation
  - `package.json`, `tsconfig.json`, `.eslintrc.js`, `.env.example`, `.gitignore`, `README.md`
- `templates/backend-python/` — Python + FastAPI backend template
  - Strict layering: Routes → Services → Repositories → Models
  - `src/config/settings.py` — Pydantic-validated environment config
  - `src/constants/` — api.py, errors.py, roles.py
  - `src/dependencies/` — Dependency injection
  - `tests/test_user_service.py` — Unit test example
  - `scripts/validate_architecture.py` — Architecture compliance validation
  - `pyproject.toml`, `.env.example`, `.gitignore`, `README.md`
- `templates/frontend-react/` — React + TypeScript + Vite frontend template
  - Strict separation: Routes → Pages → Components → Hooks → Services
  - `src/config/index.ts` — Environment config layer (never access `import.meta.env` directly)
  - `src/constants/` — api.ts, routes.ts
  - `src/hooks/` — useAuth.ts, useUsers.ts, useUser.ts
  - `src/services/` — apiClient.ts, authService.ts, userService.ts
  - `src/components/` — LoadingSpinner, ErrorMessage, UserList, UserDetail, ProtectedRoute
  - `src/pages/` — UserListPage, UserDetailPage
  - `package.json`, `tsconfig.json`, `vite.config.ts`, `.env.example`, `.gitignore`, `README.md`
- `.cursor/rules.md` — AI governance rules (mandatory, always injected by Cursor)
- `.cursor/config.json` — Forces `alwaysApplyRules: true`
- `docs/cursor-rules-reference.md` — Full reference with code examples for all stacks
- `.github/PULL_REQUEST_TEMPLATE.md` — PR checklist enforcing architectural compliance
- `.github/AI_REVIEW_PROMPT.md` — AI-assisted code review prompt
- `.github/workflows/architecture-check.yml` — CI architecture validation
- `README.md` — Project overview, quick start, and architecture documentation
- `monorepo/README.md` — Monorepo setup guide

---

*Maintained by AI Factory. See [platform-versioning-policy.md](docs/project-policies/platform-versioning-policy.md) for release and tagging rules.*
