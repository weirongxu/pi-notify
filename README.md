# pi-notify

A desktop notification extension for the [pi](https://github.com/earendil-works/pi-coding-agent) coding agent.

`pi-notify` fires a native desktop notification when pi **finishes** a task, **asks you a question**, or **requests permission** — so you can step away from long-running work and get pinged when pi needs you back.

## Installation

```bash
pi install npm:pi-notify
```

Or, for local development, add the repo path to your `~/.pi/agent/settings.json`:

```jsonc
{
  "extensions": ["/absolute/path/to/pi-notify"],
}
```

## What triggers a notification

| Event          | Source                                                                                                           | Default body                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Finished**   | `agent_settled` (pi is idle and waiting for input)                                                               | `Ready for input`                   |
| **Ask**        | `tool_call` on a question tool (default: `ask_user_question`)                                                    | `Pi has a question for you`         |
| **Permission** | `permissions:ui_prompt` broadcast by [`@gotgenes/pi-permission-system`](https://github.com/gotgenes/pi-packages) | the permission prompt's own message |

The **Permission** trigger is a soft dependency: if `pi-permission-system` is not installed, permission notifications are simply skipped — the other two events still fire.

## Configuration

All options live under the `piNotify` key in `~/.pi/agent/settings.json`. Everything is optional.

```jsonc
{
  "piNotify": {
    "enabled": true, // master switch
    "title": "Pi", // notification title
    "askTools": ["ask_user_question"], // tool names that count as "ask"
    "events": {
      "ask": true,
      "permission": true,
      "finished": true,
    },
    "finishedThrottleSecs": 0, // 0 = always notify; >0 = skip finished toasts for runs shorter than N seconds
  },
}
```

## Platform support

`pi-notify` prefers `node-notifier` (macOS Notification Center, Linux `notify-send`, native Windows toaster).

**WSL2 note:** `node-notifier` reports `process.platform === "linux"` and would route to `notify-send`, which is usually not installed under WSL and fails silently. `pi-notify` detects WSL and raises a Windows toast via `powershell.exe` directly, so notifications reach the Windows Action Center out of the box.

## Notes & limitations

- Notifications fire in all run modes (interactive TUI, `pi -p`, and JSON).
- Permission notifications are gated to UI-bearing sessions, which also prevents duplicate toasts from in-process subagent children.
- "Finished" fires on every `agent_settled`. For rapid interactive back-and-forth, set `finishedThrottleSecs` to suppress toasts for short runs.
