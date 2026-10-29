'use client';

import * as React from 'react';
import type { Column } from '@schema/ui-kit';
import { ChevronDown } from 'lucide-react';
import { useText } from '@/i18n/useText';
import { useIsMobile } from '@/hooks/useMediaQuery';

/** Mobile summaries reuse table cells so polling, permissions and actions stay consistent. */
export function MobileRecordList<T extends { id: string }>({ data, columns, title, primaryLabel, statusColumn, secondaryColumns = [], detailColumns = [], desktop }: {
  data: T[];
  columns: Column<T>[];
  title: (row: T) => React.ReactNode;
  primaryLabel: string | ((row: T) => string);
  statusColumn: string;
  secondaryColumns?: string[];
  detailColumns?: string[];
  desktop: React.ReactNode;
}) {
  const t = useText();
  const isMobile = useIsMobile();
  if (!isMobile) return <div className="yj-record-desktop">{desktop}</div>;
  const cell = (column: Column<T>, row: T) => typeof column.accessor === 'function'
    ? column.accessor(row) : row[column.accessor] as React.ReactNode;
  const find = (id: string) => columns.find(column => column.id === id && column.visible !== false);
  const status = find(statusColumn);
  const fields = (ids: string[], row: T) => ids.flatMap(id => {
    const column = find(id);
    return column ? [<div key={id} data-field={id} className="yj-mobile-record-field"><dt>{column.header}</dt><dd>{cell(column, row)}</dd></div>] : [];
  });
  return <ul className="yj-mobile-records">
    {data.map(row => <li key={row.id} className="yj-mobile-record">
      <div className="yj-mobile-record-heading">
        <div className="yj-mobile-record-identity"><p>{typeof primaryLabel === 'function' ? primaryLabel(row) : primaryLabel}</p><h3>{title(row)}</h3></div>
        {status && <div className="yj-mobile-record-status"><p>{status.header}</p>{cell(status, row)}</div>}
      </div>
      <dl className="yj-mobile-record-fields">{fields(secondaryColumns, row)}</dl>
      <details className="yj-mobile-record-details">
        <summary>{t('tasks.details4f55ee')} · {t('admin.actionsf3ea6d')}<ChevronDown aria-hidden="true" /></summary>
        <dl className="yj-mobile-record-fields">{fields(detailColumns, row)}</dl>
        {find('actions') && <div className="yj-mobile-record-actions">{cell(find('actions')!, row)}</div>}
      </details>
    </li>)}
  </ul>;
}
