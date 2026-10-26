import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {EditTaskModal} from './EditTaskModal';
import {normalizeTask} from '@/lib/tasks';
it.each(['running','completed','pending_interpretation','cancelled','waiting_for_data'])('rejects editing through an existing modal for %s',status=>{
 const save=vi.fn();render(<EditTaskModal isOpen onClose={vi.fn()} onSubmit={save} task={normalizeTask({id:'task',status})}/>);
 expect(screen.getByRole('button',{name:'保存'})).toBeDisabled();
 fireEvent.submit(document.body.querySelector('form')!);expect(save).not.toHaveBeenCalled();
});
