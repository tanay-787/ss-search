# Job Journal Integration & Evaluation Report

## Design Evaluation vs. Durable Workflow

### 1. Consistency Check: State Management
- **In-Sync**: The `JobJournalProvider` effectively mirrors the durable state stored in SQLite by polling `getExecutorStats` every 5 seconds. This ensures that even if background tasks (run by the OS) modify the database, the UI remains eventually consistent.
- **Inconsistency**: The `JobJournalIntakeResult` from `ingestJobJournalScreenshots` is currently discarded in the `sync` action. While stats are refreshed, the immediate feedback of "X new jobs created" is lost to the caller.
- **Resolution**: I will update the `sync` action to return the `IntakeResult` for ephemeral UI feedback (e.g., a toast).

### 2. Idempotency & Concurrency
- **Consistency**: The `isSyncing` and `isProcessing` flags in the Provider prevent overlapping redundant calls from the same UI session.
- **Durable Safety**: Since the underlying `03-executor.ts` uses leases and atomic SQLite transactions, the system is safe even if the Provider's flags were bypassed or if multiple background workers ran simultaneously.

### 3. Error Handling
- **Consistency**: `lastError` is captured and exposed.
- **Gaps**: The core workflow uses specific `JobJournalErrorCode`s (e.g., `MODEL_UNAVAILABLE`). The current hook implementation collapses these into strings.
- **Resolution**: Expose the `errorCode` in `useJobJournalOperations` so the UI can use `timeoutErrorToMessage` for localized, user-friendly errors.

### 4. Lifecycle & Cleanup
- **Consistency**: The Provider correctly cleans up model subscriptions and the `modelMonitor` on unmount.
- **Observation**: In a mobile environment, the Provider might unmount/remount frequently. The idempotent design of `initModelMonitor` and `ensureReady` handles this gracefully.

---

## Application Integration Flow

### 1. Initialization Phase (`src/app/index.tsx`)
- **Database**: `initializeJobJournalDatabase()` ensures schema and migrations are applied before any UI renders.
- **Background**: `registerJobJournalBackgroundTask()` and `scheduleJobJournalBackgroundTask()` are called once. This ensures that even if the app is closed, the OS can wake it up to process jobs.
- **Cleanup**: Legacy pipeline tasks are unregistered to prevent resource contention.

### 2. Central State Layer (`JobJournalProvider`)
- Wraps the application at the root (`_layout.tsx`).
- It is the **only** component that directly initializes the `modelMonitor`.
- It serves as a bridge between the imperative SQLite-based workflow and the declarative React UI.

### 3. Consumption Layer (Feature Hooks)
- **`useLibrarySummary`**: Uses `useJobJournalStats` to show high-level counts on the Home screen.
- **`useScreenshotLibrary`**: Uses a complex join query to provide a "live" view of screenshot processing status in the browser, allowing users to see which images are currently "working" or "indexed".
- **Action Triggers**: Screens use `useJobJournalOperations` to manually trigger `sync` (e.g., on pull-to-refresh).

### 4. Model Lifecycle
- **`useJobJournalModel`**: Used by a "Model Download Gate" or settings screen to manage SigLIP binaries. Because this hook consumes the centralized Provider, initiating a download in one screen will update the progress bar in all other screens.

---

## Recommended Refinements

1.  **Refine `sync` return**: Allow `useJobJournalOperations().sync()` to return the `JobJournalIntakeResult`.
2.  **Expose Error Codes**: Update `JobJournalState` to include `lastErrorCode: JobJournalErrorCode | null`.
3.  **Vector Requirement Toggle**: Allow `sync` to accept `vectorRequired` as an option, passed down from app settings.
