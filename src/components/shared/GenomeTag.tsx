import {badgeColors,badgeShape} from './badge-styles';
import {cn} from '@/lib/utils';

/** One palette for the genome column in pipelines, BED files and baselines. */
export function GenomeTag({genome}:{genome?:string}) {
 const normalized=genome?.toLowerCase();
 const name=normalized==='hg19'||normalized==='grch37'?'hg19':normalized==='hg38'||normalized==='grch38'?'hg38':null;
 return name?<span data-genome={name} className={cn(badgeShape,'whitespace-nowrap',badgeColors[name==='hg19'?'blue':'purple'])}>{name}</span>:<span>{genome||'—'}</span>;
}
