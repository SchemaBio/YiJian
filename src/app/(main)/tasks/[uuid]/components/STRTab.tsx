'use client';
import * as services from '../result-api';
import { STRTabView } from './STRTabView';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { IGVViewer, PositionLink } from './IGVViewer';

type Props = Omit<React.ComponentProps<typeof STRTabView>, 'PositionLink' | 'services' | 'ParquetColumnFilterBar' | 'IGVViewer'>;
export function STRTab(props: Props) { return <STRTabView {...props} PositionLink={PositionLink} services={services} ParquetColumnFilterBar={ParquetColumnFilterBar} IGVViewer={IGVViewer} />; }
