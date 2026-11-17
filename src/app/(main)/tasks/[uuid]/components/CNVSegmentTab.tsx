'use client';
import * as services from '../result-api';
import { CNVSegmentTabView } from './CNVSegmentTabView';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { CNVDetailPanel } from './CNVDetailPanel';

type Props = Omit<React.ComponentProps<typeof CNVSegmentTabView>, 'services' | 'ParquetColumnFilterBar' | 'CNVDetailPanel'>;
export function CNVSegmentTab(props: Props) { return <CNVSegmentTabView {...props} services={services} ParquetColumnFilterBar={ParquetColumnFilterBar} CNVDetailPanel={CNVDetailPanel} />; }
