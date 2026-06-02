# Job Journal Hook Layer: Architectural Design

## Overview
The Job Journal Hook Layer provides a predictable, idempotent, and reactive interface for the Job Journal's durable workflow. Inspired by the "Riverpod" philosophy, it separates low-level execution logic from the application state and UI, ensuring that the rest of the app interacts with a consistent and high-level API.

## Core Components

### 1. JobJournalProvider
The central state engine implemented as a React Context Provider. It is responsible for:
- **State Centralization**: Consolidating stats, model status, and operational flags.
- **Durable Sync**: Polling the database and executor for the latest job/stage statistics (defaulting to a 5-second interval).
- **Reactive Model Monitoring**: Subscribing to SigLIP model state changes to ensure the UI is always in sync with model readiness.
- **Idempotency Control**: Managing locks for `sync` and `process` operations to prevent redundant concurrent execution.

### 2. Consumer Hooks (The Public API)

#### `useJobJournalStats()`
Returns the current volume and status of jobs in the journal.
- **Outputs**: `pending`, `running`, `completed`, `failed`, `waitingForModel`, `totalJobs`, `loading`.

#### `useJobJournalModel()`
Provides a high-level interface for SigLIP model management.
- **Outputs**: `status` (`idle`, `downloading`, `ready`, `error`), `progress`, `error`.
- **Actions**: `ensureReady()`, `ensureTextReady()`, `unload()`.

#### `useJobJournalOperations()`
Exposes the primary actions for triggering the workflow.
- **Actions**:
  - `sync()`: Triggers intake and deduplication of screenshots.
  - `process()`: Runs the next set of pending stage executions (immediately in foreground).
- **Outputs**: `isSyncing`, `isProcessing`, `lastError`.

## Design Principles

### Idempotency
All operations exposed through the hook layer are guarded. For example, calling `sync()` multiple times while a sync is already in progress will be ignored or queued correctly, preventing database lock contention or redundant work.

### Predictability
The hooks return standardized types. The UI doesn't need to know about `SQLiteDatabase` objects or raw row results; it receives pre-processed, high-level objects.

### Separation of Concerns
The `JobJournalProvider` handles the "how" (timers, subscriptions, runner calls), while the UI/App State hooks handle the "what" (displaying counts, triggering sync).

## Integration Strategy
The `JobJournalProvider` should be placed high in the component tree (e.g., in `_layout.tsx`) to ensure that stats and model status are available throughout the application without repeated initializations.
