// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { checkTaskDetailAccess } from './task-detail-access';
afterEach(() => {vi.unstubAllGlobals(); vi.unstubAllEnvs();});
it('blocks calibration reports and preserves WES reports using the trusted backend', async () => {
 vi.stubEnv('YIJIAN_SERVER_API_URL','http://trusted-api:8080/api');
 vi.stubEnv('YIJIAN_BACKEND','squid');
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({data:{id:'task',template:'baseline_fix'}})).mockResolvedValueOnce(Response.json({data:{id:'task',template:'single'}}));
 vi.stubGlobal('fetch',fetcher);
 expect(await checkTaskDetailAccess('task','test-session')).toBe('not_found');
 expect(await checkTaskDetailAccess('task','test-session')).toBe('allowed');
 expect(fetcher).toHaveBeenCalledWith('http://trusted-api:8080/api/v1/octopus/tasks/task',expect.objectContaining({cache:'no-store',redirect:'manual',headers:{Authorization:'Bearer test-session'}}));
});
it('does not render a report on unavailable, unauthorized or incomplete metadata', async () => {
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response('',{status:401})).mockResolvedValueOnce(new Response('',{status:404})).mockResolvedValueOnce(Response.json({data:{id:'task'}})).mockRejectedValueOnce(new Error('offline')));
 for(const expected of ['unauthorized','not_found','unavailable','unavailable']) expect(await checkTaskDetailAccess('task','test-session')).toBe(expected);
});
