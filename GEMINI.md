# Session Verification & CI Parity Rules

Before completing any session, wrapping up user tasks, or committing and pushing code changes, you MUST always run the exact same verification checks as the GitHub Actions CI pipeline:

1. **Linting**: `npm run lint` (ensure 0 errors)
2. **Type Checking**: `npm run typecheck` (`tsc --noEmit`, 0 type errors)
3. **Unit Tests**: `npm test` (`vitest run`, all tests must pass)
4. **Production Build**: `npm run build` (`next build`, must compile cleanly)
5. **E2E Tests**: `npm run test:e2e` (`playwright test`, all critical flows must pass)

Or run the combined check:
```bash
npm run verify
```

### Verification Guidelines:
- **Zero Regressions**: Never finish a session or report a task as complete if any of these checks fail. If a check fails, investigate and fix the root cause before proceeding.
- **Test Isolation**: E2E tests use port 3005 and `.test-e2e.db`. Never let tests mutate `dev.db`.
- **Clean Up**: Ensure temporary `.test-e2e.db*` files are removed after test runs.
