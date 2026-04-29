# Gemini Project Context: Task Manager

## Project Overview
Task Manager is a cross-platform desktop productivity application built with **Tauri (v2)**, **React**, and **Supabase**. It provides a hierarchical task management system with offline-first capabilities, real-time synchronization, and local push notifications.

### Key Technologies
- **Frontend**: React 19, Vite, TypeScript, React Router, Tailwind-like CSS (Vanilla CSS).
- **Backend/Desktop**: Tauri v2 (Rust-based system interface).
- **Database & Auth**: Supabase (PostgreSQL, Row Level Security).
- **Local Storage**: IndexedDB (via `idb`) for caching and offline support.
- **UI Components**: Custom components with Markdown support (`@uiw/react-md-editor`).
- **State & Sync**: Optimistic UI updates with background synchronization and exponential backoff.

### Core Architecture
- **Offline-First**: Most operations are performed against a local IndexedDB cache first.
- **Sync Strategy**: `syncManager.ts` handles full synchronization with Supabase. Background syncs (`database.ts`) push local changes to the cloud asynchronously to ensure a responsive UI even with poor connectivity.
- **Task Structure**: Tasks are hierarchical (`parent_id`) and date-based (`created_date`). Incomplete tasks can be "rolled over" to subsequent days.
- **Data Persistence**: Uses `daily_task_snapshots` to preserve historical status of tasks on specific days, even if the task's current state changes.

## Building and Running

### Development
```bash
# Install dependencies
npm install

# Run the project in development mode (Vite + Tauri)
npm run tauri dev
```

### Production Build
```bash
# Build the application for the current platform
npm run tauri build
```

### Key Scripts
- `npm run dev`: Starts the Vite development server.
- `npm run build`: Compiles TypeScript and builds the Vite frontend.
- `npm run tauri`: Access the Tauri CLI.

## Development Conventions

### Data Access & Sync
- **Optimistic Updates**: Always update the local cache (`taskCache`, `calendarCache`, etc.) before initiating a background sync to Supabase.
- **Background Sync**: Use `runBackgroundSync` in `src/lib/database.ts` for mutations to handle retries and network instability.
- **Sequential Safety**: Before performing full syncs or destructive operations, use `await waitForBackgroundSyncs()` to ensure all pending local changes have been pushed to the server.

### State Management
- Prefer functional components and hooks.
- Business logic is centralized in `src/lib/` (e.g., `database.ts`, `syncManager.ts`).
- Utility functions for dates and task trees are located in `src/utils/`.

### Styling
- CSS is organized in component-specific files (e.g., `Tasks.css`, `Layout.css`).
- Adhere to the existing dark-themed, modern aesthetic.

### Testing
- Utility tests are located in `src/utils/__tests__/`.
- Use existing tests (like `dateUtils.test.ts`) as templates for new logic.

## Project Structure
- `src/`: React frontend source code.
  - `components/`: UI components organized by feature (auth, tasks, schedules, etc.).
  - `hooks/`: Custom React hooks (swipe gestures, scroll behavior).
  - `lib/`: Core business logic, Supabase client, and sync management.
  - `types/`: TypeScript interfaces and domain types.
  - `utils/`: Pure helper functions.
- `src-tauri/`: Rust backend and Tauri configuration.
- `supabase/`: Database schema, migrations, and edge functions.
