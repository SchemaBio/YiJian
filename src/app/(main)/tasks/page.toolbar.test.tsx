import {fireEvent,render,screen,within} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import TasksPage from './page';
import {downloadImportWorkbook} from '@/lib/import-workbook';
vi.mock('@/lib/import-workbook',()=>({downloadImportWorkbook:vi.fn(async()=>{})}));
import {BusinessPermissionContext} from '@/components/providers/BusinessPermissionProvider';
const state=vi.hoisted(()=>({backend:'octopus',tasks:[],refetch:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('@/lib/runtime-config',()=>({getRuntimeBackendFlavor:()=>state.backend}));
vi.mock('@/hooks',()=>({usePolling:()=>({data:state.tasks,loading:false,error:null,refetch:state.refetch})}));
vi.mock('./components',()=>({
 NewTaskModal:({isOpen}:{isOpen:boolean})=>isOpen?<div>New task form</div>:null,
 BatchTaskModal:({isOpen}:{isOpen:boolean})=>isOpen?<div>Batch information preview</div>:null,
 EditTaskModal:()=>null,
}));
beforeEach(()=>{state.backend='octopus';});
it.each(['octopus','squid'])('groups download, upload and new task at the table for %s',backend=>{
 state.backend=backend;render(<TasksPage/>);
 const group=screen.getByRole('group',{name:'任务操作'});
 expect(group.closest('.yj-panel-header')).not.toBeNull();
 expect(within(group).getByRole('button',{name:'下载模板'})).toBeEnabled();
 expect(within(group).getByRole('button',{name:'上传信息'})).toBeEnabled();
 expect(within(group).getByRole('button',{name:'新建任务'})).toBeEnabled();
 expect(screen.queryByRole('button',{name:'批量新建'})).not.toBeInTheDocument();
 fireEvent.click(within(group).getByRole('button',{name:'上传信息'}));
 expect(screen.getByText('Batch information preview')).toBeInTheDocument();
 fireEvent.click(within(group).getByRole('button',{name:'新建任务'}));
 expect(screen.getByText('New task form')).toBeInTheDocument();
});
it('keeps template downloads available to a self-hosted reader',()=>{

 render(<BusinessPermissionContext.Provider value={()=>false}><TasksPage/></BusinessPermissionContext.Provider>);
 expect(screen.getByRole('button',{name:'上传信息'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'新建任务'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'下载模板'}));expect(downloadImportWorkbook).toHaveBeenCalledWith(expect.stringContaining('PROBAND-001,builtin-wes-family-hg19'), 'task-batch-import-template.xlsx','批量任务');
});
