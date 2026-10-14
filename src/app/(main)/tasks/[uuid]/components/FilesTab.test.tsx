import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { FilesTab } from './ReportTab';
const mocks=vi.hoisted(()=>({flavor:'squid',templates:vi.fn(),generations:vi.fn()}));
vi.mock('@/lib/runtime-config',()=>({getRuntimeBackendFlavor:()=>mocks.flavor}));
vi.mock('@/lib/reports',()=>({reportsApi:{listTemplates:mocks.templates,listGenerations:mocks.generations},saveDownload:vi.fn()}));
vi.mock('./RawResultDownloads',()=>({RawResultDownloads:({taskId}:{taskId:string})=><div>analysis-files-{taskId}</div>}));
beforeEach(()=>{mocks.flavor='squid';mocks.templates.mockReset().mockResolvedValue([]);mocks.generations.mockReset().mockResolvedValue([]);});
it('SaaS mounts only analysis files and makes no template or generation queries',()=>{
 render(<FilesTab taskId="task" />);
 expect(screen.getByText('analysis-files-task')).toBeInTheDocument();
 expect(mocks.templates).not.toHaveBeenCalled();expect(mocks.generations).not.toHaveBeenCalled();
});
it('open source retains template and generation queries in the files tab',async()=>{
 mocks.flavor='octopus';render(<FilesTab taskId="task" />);
 await waitFor(()=>{expect(mocks.templates).toHaveBeenCalledOnce();expect(mocks.generations).toHaveBeenCalledWith('task');});
});
