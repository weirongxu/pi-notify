# @raidou/pi-notify

A notification extension for the [pi](https://github.com/earendil-works/pi-coding-agent) coding agent.

`@raidou/pi-notify` fires a native desktop notification on idle, configured tool calls (e.g., `Tool call: ask_user`), and custom pi events (default: `permissions:ui_prompt`).

## Installation

```bash
pi install npm:@raidou/pi-notify
```

Or, for local development, add the repo path to your `~/.pi/agent/settings.json`:

```jsonc
{
  "extensions": ["/absolute/path/to/pi-notify"],
}
```

## What triggers a notification

| Event             | Source                                                      | Default body                                |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------- |
| **Finished**      | `agent_settled` (pi idle, no active jobs)                   | `Idle`                                      |
| **Tool calls**    | `tool_call` on tools in `notifyTools`                       | `Tool call: <toolName>`                     |
| **Custom events** | Custom pi event channels (default: `permissions:ui_prompt`) | Customizable (default: `Permission prompt`) |

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

## Configuration

All options live under the `piNotify` key in `~/.pi/agent/settings.json`. Everything is optional.

```jsonc
{
  "piNotify": {
    "enabled": true, // master on/off switch (default: true)
    "notifyTools": ["ask_user", "ask_user_question"], // tools that trigger "Tool call" notifications
    "tmuxSymbol": "🔔", // symbol appended to tmux window title (empty string to disable)
    "finished": true, // enable/disable "Idle" notification
    "events": {
      "permissions:ui_prompt": "Permission prompt", // custom event channel -> notification message
      "my:custom:event": "Custom event triggered", // add your own custom events
    },
    "finishedThrottleSecs": 0, // 0 = always notify; >0 = skip finished toasts for runs shorter than N seconds
    "onlyNotifyWhenUnfocused": true, // only notify when user has been inactive
    "unfocusedActivityThresholdSecs": 30, // seconds of inactivity before considering user "unfocused"
  },
}
```

### Disabling specific events

To disable a specific event, set its message to an empty string:

```jsonc
{
  "piNotify": {
    "events": {
      "permissions:ui_prompt": "", // disable permission notifications
    },
  },
}
```

## Testing

Run `/notify-test` inside pi to fire a test notification.
Pass a string argument (e.g., `/notify-test hello`) to override the body.

## Platform support

`@raidou/pi-notify` prefers `node-notifier` (macOS Notification Center, Linux `notify-send`, native Windows toaster).

**WSL2 note:** `node-notifier` reports `process.platform === "linux"` and would route to `notify-send`, which is usually not installed under WSL and fails silently. `@raidou/pi-notify` detects WSL and raises a Windows toast via `powershell.exe` directly, so notifications reach the Windows Action Center out of the box.
