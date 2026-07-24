# Contributing

Thank you for your interest in contributing to `pi-desktop-notify`!

## Development Setup

```bash
# Clone and install dependencies
git clone <your-fork>
cd pi-desktop-notify
pnpm install

# Run type checking and linting
pnpm test
```

## Running Tests

```bash
# Type check
pnpm run test:types

# Lint (with auto-fix)
pnpm run test:lint
```

## Code Style

- Use TypeScript with strict mode enabled
- Follow existing code patterns and module organization
- Prefer self-documenting code over comments
- Use `pnpm run test:lint` to format with Prettier

## Project Structure

```
src/
  index.ts         # Extension entry point
  config.ts        # Configuration loading
  notifier.ts      # Desktop notification abstraction
  focus.ts         # Terminal focus detection
  tmux-title.ts    # tmux window title tracking
  permission.ts    # Permission event handling
  tool.ts          # Tool call notifications
  finished.ts      # Agent settled notifications
  states.ts        # Session state tracking
  types.ts         # TypeScript types
  utils.ts         # Utility functions
```

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b my-feature`)
3. Make your changes and run `pnpm test`
4. Commit with conventional commit format (optional, ask if unsure)
5. Push and open a pull request

## License

By contributing, you agree that your contributions will be licensed under the MIT License.