'use client';

import * as React from 'react';

// Keeps the input responsive while the table query is committed only after a
// short pause. The caller still owns the URL-backed filter state.
export function useDebouncedSearch(value: string, onCommit: (value: string) => void, delay = 300) {
  const [input, setInput] = React.useState(value);

  React.useEffect(() => {
    setInput(value);
  }, [value]);

  React.useEffect(() => {
    if (input === value) return;
    const timer = window.setTimeout(() => onCommit(input), delay);
    return () => window.clearTimeout(timer);
  }, [delay, input, onCommit, value]);

  return [input, setInput] as const;
}
