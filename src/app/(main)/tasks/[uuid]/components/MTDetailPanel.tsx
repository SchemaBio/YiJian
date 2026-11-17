'use client';
import { MTACMGEditor } from './MTACMGEditor';
import { MTDetailPanelView } from './MTDetailPanelView';
export function MTDetailPanel(props: Omit<React.ComponentProps<typeof MTDetailPanelView>, 'MTACMGEditor'>) { return <MTDetailPanelView {...props} MTACMGEditor={MTACMGEditor}/>; }
