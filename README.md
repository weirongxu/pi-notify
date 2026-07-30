# pi-desktop-notify

A desktop notification extension for the [pi](https://github.com/earendil-works/pi-coding-agent) coding agent.

`pi-desktop-notify` fires a native desktop notification when pi **finishes** a task, **asks you a question**, or **requests permission** — so you can step away from long-running work and get pinged when pi needs you back.

## Installation

```bash
pi install npm:pi-desktop-notify
```

Or, for local development, add the repo path to your `~/.pi/agent/settings.json`:

```jsonc
{
  "extensions": ["/absolute/path/to/pi-desktop-notify"],
}
```

## What triggers a notification

| Event          | Source                                                                                                           | Default body                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Finished**   | `agent_settled` (pi is idle and waiting for input)                                                               | `Ready for input`                   |
| **Ask**        | `tool_call` on tools listed in `askTools` (default: `["ask_user", "ask_user_question"]`)                        | `Pi has a question for you`         |
| **Custom events** | Custom pi event channels (default: `permissions:ui_prompt`)                              | Customizable (default: `Permission prompt`) |

Custom event notifications are soft dependencies: if a package that broadcasts a specific event is not installed, that notification is simply skipped — the other events still fire.

## Configuration

All options live under the `piNotify` key in `~/.pi/agent/settings.json`. Everything is optional.

```jsonc
{
  "piNotify": {
    "enabled": true, // master switch
    "askTools": ["ask_user", "ask_user_question"], // tool names that trigger ask notifications (empty array to disable)
    "finished": true, // enable/disable "Ready for input" notification
    "events": {
      "permissions:ui_prompt": "Permission prompt", // custom event channel -> notification message
      "my:custom:event": "Custom event triggered", // add your own custom events
    },
    "finishedThrottleSecs": 0, // 0 = always notify; >0 = skip finished toasts for runs shorter than N seconds
    "onlyNotifyWhenUnfocused": false, // only notify when user has been inactive
    "unfocusedActivityThresholdSecs": 30, // seconds of inactivity before considering user "unfocused"
  },
}
```

### Disabling specific events

To disable a specific event, set its message to an empty string:

```jsonc
{
  "piNotify": {
    "finished": true,
    "events": {
      "permissions:ui_prompt": "", // disable permission notifications
    },
  },
}
```

## Platform support

`pi-desktop-notify` prefers `node-notifier` (macOS Notification Center, Linux `notify-send`, native Windows toaster).

**WSL2 note:** `node-notifier` reports `process.platform === "linux"` and would route to `notify-send`, which is usually not installed under WSL and fails silently. `pi-desktop-notify` detects WSL and raises a Windows toast via `powershell.exe` directly, so notifications reach the Windows Action Center out of the box.

## Notes & limitations

- Notifications fire in all run modes (interactive TUI, `pi -p`, and JSON).
- Custom event notifications are gated to UI-bearing sessions, which also prevents duplicate toasts from in-process subagent children.
- "Finished" fires on every `agent_settled`. For rapid interactive back-and-forth, set `finishedThrottleSecs` to suppress toasts for short runs.
- Set `onlyNotifyWhenUnfocused: true` to suppress notifications when you're actively using pi. User activity (keypresses) in TUI mode is tracked, and notifications are only sent after `unfocusedActivityThresholdSecs` seconds of inactivity.
- **Hardcoded dependencies**: Some internal tool names and event channels are duplicated from pi and pi-permission-system since they aren't exported. If these change in upstream packages, notifications may stop working:
  - `ask_user`, `ask_user_question` - built-in pi question tools
  - `permissions:ui_prompt` - pi-permission-system broadcast channel