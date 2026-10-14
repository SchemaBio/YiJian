import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InterpretationReadOnlyContext } from './InterpretationLock';
import { PinCheckbox, FocusCheckbox } from './ReviewCheckboxes';

describe('completed interpretation editing', () => {
  it('blocks pin and report changes until completion is cancelled', () => {
    const change = vi.fn();
    const content = (locked: boolean) => <InterpretationReadOnlyContext.Provider value={locked}><PinCheckbox checked={false} onChange={change} /><FocusCheckbox checked={false} onChange={change} /></InterpretationReadOnlyContext.Provider>;
    const { rerender } = render(content(true));
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(change).not.toHaveBeenCalled();
    rerender(content(false));
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeEnabled();
      fireEvent.click(button);
    }
    expect(change).toHaveBeenCalledTimes(2);
  });
});
