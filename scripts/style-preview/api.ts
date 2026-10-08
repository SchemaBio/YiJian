export class ApiError extends Error { status = 500; }
const views: any[] = [];
const transactions = ['recharge','pre_deduction','deduction','refund','failure_refund','adjust','download'].map((type,i)=>({id:i+1,type,org_id:'preview',amount:[1000,-75,-20,55,75,10,-1][i],balance_after:1000,description:'合成账单 · 仅用于界面预览',created_by:1,created_at:'2026-10-08T09:00:00Z'}));
export const api = {
  get: async (url: string) => {
    if(url.endsWith('/views')) return views;
    if(url.endsWith('/dashboard/stats')) return {totalSamples:12,pendingTasks:8,waitingDataTasks:4,runningTasks:4,completedTasks:8,failedTasks:4};
    if(url.endsWith('/billing/balance')) return {org_id:'preview',balance:1000};
    if(url.endsWith('/billing/config')) return {credits_per_minute:1,credit_rate_multiplier:1,download_credits:1,min_balance:0,cnv_baseline_credits_per_gib:2};
    if(url.endsWith('/billing/transactions')) return {items:transactions,total:transactions.length,page:1,page_size:20,total_pages:1};
    return [];
  },
  put: async (url: string, body: any) => { if (url.endsWith('/views')) { const current = views.find(item => item.name === body.name); if (current) Object.assign(current, { stateJson: JSON.stringify(body.state), version: current.version + 1 }); else views.push({ name: body.name, stateJson: JSON.stringify(body.state), version: 1 }); return; } throw new Error('预览不写入生产服务'); },
  post: async () => { throw new Error('预览不提交任务'); }, delete: async () => { throw new Error('预览不删除任务'); },
};
export const clearAuthSession = () => {};
export const clearLegacyAuthTokens = () => {};
