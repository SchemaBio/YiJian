export class ApiError extends Error { status = 500; }
const views: any[] = [];
export const api = {
  get: async (url: string) => url.endsWith('/views') ? views : [],
  put: async (url: string, body: any) => { if (url.endsWith('/views')) { const current = views.find(item => item.name === body.name); if (current) Object.assign(current, { stateJson: JSON.stringify(body.state), version: current.version + 1 }); else views.push({ name: body.name, stateJson: JSON.stringify(body.state), version: 1 }); return; } throw new Error('预览不写入生产服务'); },
  post: async () => { throw new Error('预览不提交任务'); }, delete: async () => { throw new Error('预览不删除任务'); },
};
export const clearAuthSession = () => {};
export const clearLegacyAuthTokens = () => {};
