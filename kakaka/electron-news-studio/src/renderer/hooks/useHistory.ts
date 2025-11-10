import { useState, useCallback, useRef } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useHistory<T>(initialState: T) {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: []
  });

  const isUndoing = useRef(false);

  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory(current => {
      const actualNewState = typeof newState === 'function'
        ? (newState as (prev: T) => T)(current.present)
        : newState;

      // Don't add to history if undoing/redoing
      if (isUndoing.current) {
        isUndoing.current = false;
        return {
          ...current,
          present: actualNewState
        };
      }

      return {
        past: [...current.past, current.present],
        present: actualNewState,
        future: []
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory(current => {
      if (current.past.length === 0) return current;

      const previous = current.past[current.past.length - 1];
      const newPast = current.past.slice(0, current.past.length - 1);

      isUndoing.current = true;

      return {
        past: newPast,
        present: previous,
        future: [current.present, ...current.future]
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(current => {
      if (current.future.length === 0) return current;

      const next = current.future[0];
      const newFuture = current.future.slice(1);

      isUndoing.current = true;

      return {
        past: [...current.past, current.present],
        present: next,
        future: newFuture
      };
    });
  }, []);

  const clear = useCallback(() => {
    setHistory(current => ({
      past: [],
      present: current.present,
      future: []
    }));
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear
  };
}
