'use client';
import { SelfHostedOnly } from '@/components/shared/ResearchPolicy';
import HistoryWorkspace from './HistoryWorkspace';
export default function HistoryPage() { return <SelfHostedOnly><HistoryWorkspace /></SelfHostedOnly>; }
