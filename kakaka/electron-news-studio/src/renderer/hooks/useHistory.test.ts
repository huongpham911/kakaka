import { renderHook, act } from '@testing-library/react';
import { useHistory } from './useHistory';

describe('useHistory Hook', () => {
  it('should initialize with initial state', () => {
    const { result } = renderHook(() => useHistory({ count: 0 }));
    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('should update state and allow undo', () => {
    const { result } = renderHook(() => useHistory({ count: 0 }));

    // Update state
    act(() => {
      result.current.setState({ count: 1 });
    });

    expect(result.current.state).toEqual({ count: 1 });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    // Undo
    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('should handle multiple state updates', () => {
    const { result } = renderHook(() => useHistory({ count: 0 }));

    // Multiple updates
    act(() => {
      result.current.setState({ count: 1 });
      result.current.setState({ count: 2 });
      result.current.setState({ count: 3 });
    });

    expect(result.current.state).toEqual({ count: 3 });
    expect(result.current.canUndo).toBe(true);

    // Undo twice
    act(() => {
      result.current.undo();
      result.current.undo();
    });

    expect(result.current.state).toEqual({ count: 1 });
  });

  it('should handle redo after undo', () => {
    const { result } = renderHook(() => useHistory({ count: 0 }));

    act(() => {
      result.current.setState({ count: 1 });
      result.current.setState({ count: 2 });
    });

    // Undo
    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toEqual({ count: 1 });
    expect(result.current.canRedo).toBe(true);

    // Redo
    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toEqual({ count: 2 });
    expect(result.current.canRedo).toBe(false);
  });

  it('should clear future when setting new state after undo', () => {
    const { result } = renderHook(() => useHistory({ count: 0 }));

    act(() => {
      result.current.setState({ count: 1 });
      result.current.setState({ count: 2 });
    });

    // Undo once
    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    // Set new state (should clear redo history)
    act(() => {
      result.current.setState({ count: 10 });
    });

    expect(result.current.state).toEqual({ count: 10 });
    expect(result.current.canRedo).toBe(false);
  });

  it('should handle functional state updates', () => {
    const { result } = renderHook(() => useHistory({ count: 0 }));

    act(() => {
      result.current.setState(prev => ({ count: prev.count + 1 }));
      result.current.setState(prev => ({ count: prev.count + 1 }));
    });

    expect(result.current.state).toEqual({ count: 2 });
  });

  it('should not undo when history is empty', () => {
    const { result } = renderHook(() => useHistory({ count: 0 }));

    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.canUndo).toBe(false);
  });

  it('should not redo when future is empty', () => {
    const { result } = renderHook(() => useHistory({ count: 0 }));

    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.canRedo).toBe(false);
  });

  it('should clear history', () => {
    const { result } = renderHook(() => useHistory({ count: 0 }));

    act(() => {
      result.current.setState({ count: 1 });
      result.current.setState({ count: 2 });
    });

    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.clear();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
