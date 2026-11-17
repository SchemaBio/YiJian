'use client';
import { api } from '@/lib/api';
import { retainBrowserTable, refreshBrowserTable } from '@/lib/parquet-browser';
import { ParquetColumnFilterBarView } from './ParquetColumnFilterBarView';
export { } from './ParquetColumnFilterBarView';
const runtime = {api, retainBrowserTable, refreshBrowserTable};
export function ParquetColumnFilterBar(props: Omit<React.ComponentProps<typeof ParquetColumnFilterBarView>, 'runtime'>) { return <ParquetColumnFilterBarView {...props} runtime={runtime} />; }
