'use client';
import * as services from '../result-api';
import { MTTabView } from './MTTabView';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { MTDetailPanel } from './MTDetailPanel';
import { IGVViewer, PositionLink } from './IGVViewer';

type Props = Omit<React.ComponentProps<typeof MTTabView>, 'PositionLink' | 'services' | 'ParquetColumnFilterBar' | 'MTDetailPanel' | 'IGVViewer'>;
export function MTTab(props: Props) { return <MTTabView {...props} PositionLink={PositionLink} services={services} ParquetColumnFilterBar={ParquetColumnFilterBar} MTDetailPanel={MTDetailPanel} IGVViewer={IGVViewer} />; }
