'use client';
import * as services from '../result-api';
import { CNVExonTabView } from './CNVExonTabView';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { CNVDetailPanel } from './CNVDetailPanel';

type Props = Omit<React.ComponentProps<typeof CNVExonTabView>, 'services' | 'ParquetColumnFilterBar' | 'CNVDetailPanel'>;
export function CNVExonTab(props: Props) { return <CNVExonTabView {...props} services={services} ParquetColumnFilterBar={ParquetColumnFilterBar} CNVDetailPanel={CNVDetailPanel} />; }
