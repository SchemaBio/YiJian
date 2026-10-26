import type {AnalysisTask} from '@/types/task';
import {isFamilyAnalysisUnavailable} from './analysis-availability';
import {getRuntimeBackendFlavor} from './runtime-config';

export function canEditTask(task:AnalysisTask):boolean {
 if(!['failed','queued'].includes(task.status) || task.interpretationCompletedAt || isFamilyAnalysisUnavailable(task))return false;
 const active=task.executionPhase && !['idle','terminal'].includes(task.executionPhase);
 return !active || (task.status==='failed' && getRuntimeBackendFlavor()!=='squid');
}
