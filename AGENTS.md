# BizzDeal Backend – AI Coding Rules

These rules apply to the NestJS backend only.

## Stack

- NestJS
- TypeScript
- TypeORM
- Zod validation
- PostgreSQL

## Project Requirements

- Always consult and strictly follow `REQUIREMENTS.md` for any detailed information about project requirements, business logic, and feature specifications while implementing features and writing code.

## Backend Structure

Use a modular NestJS structure.

Recommended structure:

```txt
bizzdeal-be/
├── src/
│   ├── config/
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── utils/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeds/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── businesses/
│   │   ├── services/
│   │   ├── bookings/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── reviews/
│   │   ├── chat/
│   │   ├── meetings/
│   │   └── notifications/
│   ├── app.module.ts
│   └── main.ts
│
├── test/
├── .env
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

Simple rule:

```txt
modules/ = main business features
common/ = reusable backend helpers
config/ = env and app config
database/ = migrations, seeds, DB setup
test/ = backend tests
```


## Module Rules

- Keep each feature inside its own module.
- Each module should have clear responsibility.
- Use controller only for HTTP request/response handling.
- Use service for business logic.
- Use repository/data-access layer when TypeORM logic becomes large.
- Do not put TypeORM queries directly inside controllers.
- Do not mix unrelated feature logic.

## File Rules

- Keep files small and focused.
- Do not put DTOs, schemas, services, and models in one file.
- Place reusable interfaces/types in `src/models/`.
- Place Zod schemas in `src/schemas/` or inside the related module if feature-specific.
- Place shared helpers in `src/common/utils/`.
- Do not create new folders if an existing folder already fits.

## TypeScript Rules

- Use strict TypeScript.
- **Strict Typing**: Do not use `any` type in BE and FE. Always use strict types. In entities, always use DTOs for reference and check the FE interfaces when creating DTOs so you don't miss anything.
- Prefer explicit return types for services and public methods.
- Use `unknown` instead of `any` when handling uncertain input.
- Keep request/response types clearly defined.

## Validation Rules

- Use Zod for request validation.
- Do not use `class-validator` or `class-transformer` unless already used in the project.
- Keep validation schemas reusable.
- Validate input before business logic.
- Return clear validation errors.
- **Entity Field Naming Consistency**: Always strictly follow the exact field names defined in the TypeORM entities when defining API request payloads, DTOs, and Zod schemas (e.g., use `phone` if the entity defines `phone`, rather than `phoneNumber`).

## TypeORM Rules

- Keep TypeORM entities cleanly defined in models/entities.
- Use TypeORM through a dedicated database module/service or repository pattern.
- Keep DB access out of controllers.
- Use transactions where multiple related writes must succeed together.
- Avoid raw SQL unless necessary.
- Never expose internal database fields directly if not needed by the frontend.

## API Rules

- Use RESTful endpoints.
- Keep route names clear and consistent.
- Use proper HTTP status codes.
- Do not leak internal errors to the client.
- Return predictable response shapes.
- **No Unrequested Pagination**: Do not apply pagination (`page`, `limit`, `skip`, `take`) to list endpoints or database queries unless explicitly requested by the user.
- Use guards/interceptors where cross-cutting behavior is needed.
- **Swagger Documentation**: Always ensure Swagger documentation is kept completely up-to-date. When implementing new features or making changes to existing endpoints (such as modifying query params, request bodies, response models, or auth requirements), corresponding Swagger decorators (e.g., `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiProperty`, `@ApiBearerAuth`) must be added or updated with detailed descriptions of fields and APIs. Always specify explicit primitive data types (e.g., `type: String`, `type: Number`, `type: Boolean`) and appropriate formats (such as `format: 'date-time'`) in `@ApiProperty` and `@ApiPropertyOptional` decorators on DTOs—especially when using union types (`number | null`, `Date | string`) or `multipart/form-data` request bodies—to ensure Swagger UI renders proper, suitable single-line input controls (`<input>`) instead of unnecessary multiline text areas (`<textarea>`).
- **No Unrequested API Additions**: Do not add additional APIs, endpoints, or alternate HTTP methods (e.g., adding a GET alongside a requested POST) without explicit permission and direction from the user.
- **No Nested Relation Objects in API Responses**: When returning entities in API responses (list, detail, create, update, etc.), do not return entire nested relational objects (such as `offer`, `customer`, `business`, `owner`, `category`, `redeemed_by`, `sender`, `receiver`, etc.). Return only the foreign key ID fields (such as `offer_id`, `customer_id`, `business_id`, `owner_id`, `category_id`, `redeemed_by_id`, etc.). Do not use `eager: true` or load unnecessary relations in TypeORM queries if they cause full objects to be returned in API payloads.
- **Individual GET by ID Endpoints**: Every entity and module must provide a dedicated REST endpoint to fetch an individual record by its ID (e.g., `GET /vouchers/:id`, `GET /offers/:id`, `GET /businesses/:id`, `GET /users/:id`, `GET /media/:id`, etc.), so clients can fetch specific entity details on demand using the ID fields.

## Auth Rules

- Keep auth logic separate from feature modules.
- Use guards for protected routes.
- Do not trust user IDs from request body.
- Get authenticated user from token/session context.
- Never hardcode secrets.

## AI Module Rules

- Keep AI provider logic isolated.
- Do not call OpenAI/LLM APIs directly from unrelated services.
- Use provider abstraction if multiple AI providers may be supported.
- Keep prompts in separate files or prompt utilities.
- Avoid sending unnecessary resume data to LLMs.
- Log token usage/cost where possible.
- Never log sensitive user resume data in production.

## PDF Rules

- Keep PDF generation in the backend.
- Keep template logic separate from resume business logic.
- Do not store generated PDFs unless explicitly required.
- Keep fonts/assets paths configurable.
- Ensure PDF generation is deterministic from resume JSON.

## File Upload Rules

- **Clean Up Stale Files**: When uploading a replacement file for a specific entity or purpose (such as updating a profile picture, business logo, or document), always delete or remove the stale/previous file record from the database and storage to prevent orphaned files and data accumulation.

## Credits / Billing Rules

- Keep credit deduction logic server-side only.
- Never trust frontend credit values.
- Use transactions for credit deduction and AI action creation.
- Store credit history for auditability.
- Do not deduct credits if the paid action fails.

## Caching Rules

- Prefer Redis for shared cache.
- Do not use in-memory cache for important cross-instance logic.
- Use safe cache keys.
- Never cache sensitive data unless encrypted or clearly safe.
- Set TTLs for all cache entries.

## Error Handling Rules

- Use NestJS exceptions.
- Use global exception filter if needed.
- Log server-side details safely.
- Return clean client-friendly error messages.
- Do not expose stack traces in production.

## Environment Rules

- Use environment variables for secrets and config.
- Validate required environment variables on startup.
- Do not commit `.env` files.
- Keep `.env.example` updated when adding new variables.
- **Strict Environment & Configuration Validation**: Always enforce strict validation of critical third-party API configurations (e.g., MSG91 API keys, template IDs). If any required configuration or API key is missing or invalid, throw an explicit error with a descriptive message immediately instead of using silent fallbacks, mock data, or development bypasses.

## Testing Rules

- Add tests for important services and utility logic.
- Mock external APIs like OpenAI, Redis, and email providers.
- Keep tests close to the feature when practical.
- Do not rely on real paid APIs in tests.

## Logging Rules

- Use a proper logger.
- Do not log passwords, tokens, API keys, or full resume data.
- Log useful IDs, action names, timings, and error summaries.
- Keep production logs safe.

## Code Change Rules

Before changing backend code:

1. Read this file.
2. Read the root `AGENTS.md`.
3. Consult `REQUIREMENTS.md` for detailed requirements and specifications before implementing features or writing code.
4. Follow existing backend folder patterns.
5. Reuse existing models, schemas, services, and utilities.
6. After changes, summarize changed files and reason.
7. **Always check for build and typescript errors**: When finishing an implementation, you MUST verify that there are no active build, compilation, or TypeScript errors before marking the task as complete. Do not assume the build succeeded without checking the terminal output or running a build command.

## Output Rule for AI Coding Assistants

After completing changes, always provide:

- Files changed
- What changed
- Why it changed
- Any commands to run
- Any environment variables added
