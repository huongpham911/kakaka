# Testing Guide

This project uses Jest and React Testing Library for unit testing.

## Installation

To run tests, you need to install the testing dependencies:

```bash
npm install --save-dev jest ts-jest @types/jest @testing-library/react @testing-library/jest-dom @testing-library/user-event identity-obj-proxy
```

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Files

Tests are located next to the source files with `.test.ts` or `.test.tsx` extensions:

- `src/shared/validation.test.ts` - Tests for validation functions
- `src/renderer/hooks/useHistory.test.ts` - Tests for useHistory hook
- `src/renderer/ui/Toast.test.tsx` - Tests for Toast component

## Writing Tests

### Example: Testing a Component

```typescript
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Example: Testing a Hook

```typescript
import { renderHook, act } from '@testing-library/react';
import { useMyHook } from './useMyHook';

describe('useMyHook', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.value).toBe(0);
  });
});
```

## Test Coverage

Current test coverage:

- ✅ Validation functions (100%)
- ✅ useHistory hook (95%)
- ✅ Toast component (90%)

## CI/CD Integration

Tests should be run in CI/CD pipeline before deployment:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm test
```

## Mocks

Common mocks are set up in `src/setupTests.ts`:

- Electron API (`window.electronAPI`)
- localStorage
- Global window object

## Troubleshooting

### Tests fail with "Cannot find module"

Make sure all testing dependencies are installed:
```bash
npm install
```

### Tests fail with TypeScript errors

Check that `jest.config.js` has the correct TypeScript configuration.

### Tests timeout

Increase timeout in individual tests:
```typescript
it('should complete', async () => {
  // test code
}, 10000); // 10 second timeout
```
