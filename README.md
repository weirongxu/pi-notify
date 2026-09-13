# @raidou/pi-notify

A notification extension for the [pi](https://github.com/earendil-works/pi-coding-agent) coding agent.

`@raidou/pi-notify` fires a native desktop notification on idle, tool calls (optional, e.g. `Tool call: ask_user`), user-facing UI prompts (via pi's `ui_prompt_start`, e.g. permission approvals or `select`/`confirm`/`input` dialogs, requires pi >= 0.85.0), and custom pi events.

## Installation

```bash
pi install npm:@raidou/pi-notify
```

Or, for local development

```bash
cd path/to/pi-notify
pi install .
```

## Configuration

All options live under the `piNotify` key in `~/.pi/agent/settings.json`. Everything is optional.

```jsonc
{
  "piNotify": {
    "enabled": true, // master on/off switch (default: true)
    "notifyTools": [], // tools that trigger "Tool call" notifications (default: empty, i.e. no tool notifications)
    "tmuxSymbol": "🔔", // symbol appended to tmux window title (empty string to disable)
    "finished": true, // enable/disable "Idle" notification
    "events": {
      "my:custom:event": "Custom event triggered", // custom event channel -> notification message
      "other:event": false, // set to false to disable a specific event
    },
    "finishedThrottleSecs": 0, // 0 = always notify; >0 = skip finished toasts for runs shorter than N seconds
    "onlyNotifyWhenUnfocused": true, // only notify when user has been inactive
    "unfocusedActivityThresholdSecs": 30, // seconds of inactivity before considering user "unfocused"
  },
}
```

## What triggers a notification

| Event             | Source                                                                | Default body                      |
| ----------------- | --------------------------------------------------------------------- | --------------------------------- |
| **Finished**      | `agent_settled` (pi idle, no active jobs)                             | `Idle`                            |
| **Tool calls**    | `tool_call` on tools in `notifyTools` (default: none)                 | `Tool call: <toolName>`           |
| **UI prompts**    | `ui_prompt_start` (requires pi >= 0.85.0)                             | `Waiting: <kind>[ — <title>]` |
| **Custom events** | Custom pi event channels configured in `events`                       | Customizable                      |
| **External API**  | `pi.events.emit('pi-notify:notify', 'message')` from other extensions | The emitted message               |

### Job tracking for background tasks

Extensions running background tasks can prevent spurious "Idle" notifications by emitting job lifecycle events. Notifications on `agent_settled` are suppressed while jobs are active. Custom event notifications are soft dependencies: if a package that broadcasts a specific event is not installed, that notification is skipped.

```typescript
import { JOB_START_EVENT, JOB_END_EVENT } from '@raidou/pi-notify'

function startBackgroundJob(jobId: string): void {
  pi.events.emit(JOB_START_EVENT, { id: jobId })
}

function endBackgroundJob(jobId: string): void {
  pi.events.emit(JOB_END_EVENT, { id: jobId })
}
```

Events are automatically cleaned up on `session_shutdown`.

## Commands

### `/notify-dashboard`

Open a full-screen TUI dashboard listing all pi sessions, with summary counts (total, running, idle) and an auto-refresh every second.

Columns: `SESSION_ID` (last 6 chars), `PID`, `STATE` (running/idle, color-coded), `PROJECT`, `UPTIME`.

Keybindings:

- `j`/`k` or `↑`/`↓` — move selection
- `x` — kill (SIGTERM) the selected session
- `o` — show/hide the SESSION_ID and PID columns
- `r` — refresh
- `q` or `esc` — close

### `/notify-test`

Run `/notify-test` inside pi to fire a test notification.
Pass a string argument (e.g., `/notify-test hello`) to override the body.

## Platform support

`@raidou/pi-notify` prefers `node-notifier` (macOS Notification Center, Linux `notify-send`, native Windows toaster).

**WSL2 note:** `node-notifier` reports `process.platform === "linux"` and would route to `notify-send`, which is usually not installed under WSL and fails silently. `@raidou/pi-notify` detects WSL and raises a Windows toast via `powershell.exe` directly, so notifications reach the Windows Action Center out of the box.
