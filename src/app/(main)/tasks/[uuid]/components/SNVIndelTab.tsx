'use client';
import * as services from '../result-api';
import { SNVIndelTabView } from './SNVIndelTabView';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { VariantDetailPanel } from './VariantDetailPanel';
import { IGVViewer, PositionLink } from './IGVViewer';

type Props = Omit<React.ComponentProps<typeof SNVIndelTabView>, 'PositionLink' | 'services' | 'ParquetColumnFilterBar' | 'VariantDetailPanel' | 'IGVViewer'>;
export function SNVIndelTab(props: Props) { return <SNVIndelTabView {...props} PositionLink={PositionLink} services={services} ParquetColumnFilterBar={ParquetColumnFilterBar} VariantDetailPanel={VariantDetailPanel} IGVViewer={IGVViewer} />; }
