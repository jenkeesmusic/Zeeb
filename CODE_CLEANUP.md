# Zeeb Game - Code Cleanup Guidelines

## Comment Removal Strategy

All unnecessary comments have been removed from the codebase. Only keep comments that explain truly complex or non-obvious logic.

### Files Cleaned

- `Public/start/start.js` - Start screen with Zeeb animation
- `Public/game.js` - Level 1 gameplay
- `Public/level2/game.js` - Level 2 gameplay
- `Public/level3/game.js` - Level 3 gameplay
- `Public/level4/game.js` - Level 4 (boss battle)

### What Was Removed

- Descriptive headers and file purpose comments
- Comments explaining obvious variable names
- Comments describing straightforward logic (keyboard control, canvas clamping, entity updates)
- Comments about state definitions
- Comments about simple rendering code
- Redundant inline comments

### What Should Remain

- Comments explaining non-obvious calculations (easing functions, animation timing)
- Comments for workarounds (eslint-disable reasons, browser compatibility)
- Comments explaining complex algorithms or mathematical operations
- Comments for important game state transitions

## Code Style

- Variable names are self-documenting
- Function names clearly describe their purpose
- Code structure follows consistent patterns across all levels
- Entity classes (Rocket, Asteroid, Laser, Coin) follow similar update/draw patterns

## Future Maintenance

When adding new features or fixing bugs:
1. Keep code clean and readable through naming conventions
2. Only add comments for truly complex logic
3. Remove commented-out debug code before committing
4. Maintain consistency with existing code style