import {expect,it} from 'vitest';
import {localDataTemplate,parseLocalDataCSV} from './local-data-import';
import {locales} from '@/i18n/locales';
it.each(locales)('accepts the exact three-column %s template, including Docker paths with commas',locale=>{
 const result=parseLocalDataCSV(localDataTemplate(locale,'/data/run, one'));
 expect(result.issues).toEqual([]);
 expect(result.rows).toEqual([{line:2,internal_id:'INT-001',read1_path:'/data/run, one/INT-001_R1.fastq.gz',read2_path:'/data/run, one/INT-001_R2.fastq.gz'}]);
});
it('rejects Windows paths, repeated files and missing internal IDs',()=>{
 const header='内部编号,read1的绝对路径,read2的绝对路径\n';
 const result=parseLocalDataCSV(header+'I1,E:\\data\\a.fq,/data/b.fq\nI2,/data/a.fq,/data/a.fq\n,/data/a.fq,/data/b.fq');
 expect(result.rows).toEqual([]);expect(result.issues).toHaveLength(3);
});
it('rejects an unrelated template',()=>{expect(()=>parseLocalDataCSV('A,B,C\nx,y,z')).toThrow();});
