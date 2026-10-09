'use client';
import * as React from 'react';
export const InterpretationReadOnlyContext = React.createContext(false);
export function useInterpretationReadOnly(): boolean { return React.useContext(InterpretationReadOnlyContext); }
