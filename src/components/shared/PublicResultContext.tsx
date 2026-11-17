'use client';
import { createContext, useContext } from 'react';
export const PublicResultContext = createContext(false);
export function usePublicResult() { return useContext(PublicResultContext); }
