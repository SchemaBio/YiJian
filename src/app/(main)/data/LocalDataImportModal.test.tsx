vi.mock('@/lib/import-workbook', async original => ({
 ...await original<typeof import('@/lib/import-workbook')>(),
 readImportWorkbook: async (file: File) => {
  const {parseCSVRecords} = await import('@/lib/sample-import');
  return parseCSVRecords(await file.text());
 },
}));
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,it,vi,beforeEach} from 'vitest';
import {LocalDataImportModal} from './LocalDataImportModal';
import {api,ApiError} from '@/lib/api';
import {BusinessPermissionContext} from '@/components/providers/BusinessPermissionProvider';
vi.mock('@/lib/api',async original=>({...await original<typeof import('@/lib/api')>(),api:{post:vi.fn()}}));
beforeEach(()=>vi.clearAllMocks());
const file=Object.assign(new File(['csv'],'paths.xlsx'),{text:async()=> '内部编号,read1的绝对路径,read2的绝对路径\nI1,/data/r1.fq,/data/r2.fq'});
it('shows mount guidance, registers paths rather than uploading data and displays server UUIDs and sizes',async()=>{
 const imported=vi.fn();vi.mocked(api.post).mockResolvedValue([{id:'uuid-1',read_type:'read1',file_size:100},{id:'uuid-2',read_type:'read2',file_size:200}]);
 render(<LocalDataImportModal directory="/data" onClose={()=>{}} onImported={imported}/>);
 expect(screen.getByText(/Docker 挂载路径/)).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('选择数据路径 XLSX 文件'),{target:{files:[file]}});
 await screen.findByText('I1');expect(api.post).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'校验并登记 / 重试失败行'}));
 await waitFor(()=>expect(imported).toHaveBeenCalledOnce());
 expect(api.post).toHaveBeenCalledWith('/v1/data/local-import',{internal_id:'I1',read1_path:'/data/r1.fq',read2_path:'/data/r2.fq'},expect.objectContaining({signal:expect.any(AbortSignal)}));
 expect(screen.getByText(/uuid-1/)).toHaveTextContent('100 B');expect(screen.getByText(/uuid-2/)).toHaveTextContent('200 B');
 expect(screen.getByRole('button',{name:'校验并登记 / 重试失败行'})).toBeDisabled();
});
it('localizes failed integrity validation and permits retry without reporting success',async()=>{
 const imported=vi.fn();vi.mocked(api.post).mockRejectedValue(new ApiError(400,'Bad Request',{code:'local_import_integrity'}));
 render(<LocalDataImportModal directory="/data" onClose={()=>{}} onImported={imported}/>);
 fireEvent.change(screen.getByLabelText('选择数据路径 XLSX 文件'),{target:{files:[file]}});await screen.findByText('I1');
 fireEvent.click(screen.getByRole('button',{name:'校验并登记 / 重试失败行'}));
 expect(await screen.findByText(/gzip 校验失败/)).toBeInTheDocument();expect(imported).not.toHaveBeenCalled();
});
it('requires both data management and sample matching authorization',()=>{
 render(<BusinessPermissionContext.Provider value={permission=>permission==='data.manage'}><LocalDataImportModal directory="/data" onClose={()=>{}} onImported={()=>{}}/></BusinessPermissionContext.Provider>);
 expect(screen.getByRole('button',{name:'校验并登记 / 重试失败行'})).toBeDisabled();
});
