'use client';
import { TaskCostDetail } from '@/components/billing';
import { TaskHeaderView } from './TaskHeaderView';
export function TaskHeader(props: Omit<React.ComponentProps<typeof TaskHeaderView>, 'TaskCostDetail'>) { return <TaskHeaderView {...props} TaskCostDetail={TaskCostDetail} />; }
