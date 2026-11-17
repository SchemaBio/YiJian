'use client';
import * as React from 'react';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { AppShellView } from '@/components/layout/AppShellView';
import { SidebarNavView } from '@/components/layout/SidebarNavView';
import { PublicResultContext } from '@/components/shared/PublicResultContext';
import { BusinessPermissionContext } from '@/components/providers/BusinessPermissionProvider';
import { useLocaleSettings } from '@/components/providers/LocaleProvider';
import { locales, localeNames } from '@/i18n/locales';
import { useText } from '@/i18n/useText';
import { ActionButton, IconActionButton } from '@/components/shared/ActionButton';
import { WorkspaceInspector, InspectorTabs, type InspectorSection } from '@/components/shared/WorkspaceInspector';
import { TaskHeaderView } from '@/app/(main)/tasks/[uuid]/components/TaskHeaderView';
import { SampleSummaryCardView } from '@/app/(main)/tasks/[uuid]/components/SampleSummaryCardView';
import { ResultTabs } from '@/app/(main)/tasks/[uuid]/components/ResultTabs';
import { VariantTypeNav } from '@/app/(main)/tasks/[uuid]/components/VariantTypeNav';
import { ResultOverview } from '@/app/(main)/tasks/[uuid]/components/ResultOverview';
import { QCAndFamilyTables } from '@/app/(main)/tasks/[uuid]/components/QCResultTab';
import { SNVIndelTabView } from '@/app/(main)/tasks/[uuid]/components/SNVIndelTabView';
import { CNVExonTabView } from '@/app/(main)/tasks/[uuid]/components/CNVExonTabView';
import { CNVSegmentTabView } from '@/app/(main)/tasks/[uuid]/components/CNVSegmentTabView';
import { STRTabView } from '@/app/(main)/tasks/[uuid]/components/STRTabView';
import { MTTabView } from '@/app/(main)/tasks/[uuid]/components/MTTabView';
import { MTDetailPanelView } from '@/app/(main)/tasks/[uuid]/components/MTDetailPanelView';
import { ParquetColumnFilterBarView } from '@/app/(main)/tasks/[uuid]/components/ParquetColumnFilterBarView';
import { SNVAnnotationSections, InfoItem } from '@/app/(main)/tasks/[uuid]/components/SNVAnnotationSections';
import { CNVAnnotationSection } from '@/app/(main)/tasks/[uuid]/components/CNVAnnotationSection';
import { VariantAssessmentOverview } from '@/app/(main)/tasks/[uuid]/components/VariantAssessmentOverview';
import { CNVAssessmentOverview } from '@/app/(main)/tasks/[uuid]/components/CNVAssessmentOverview';
import { ClinicalSignificanceBadge } from '@/app/(main)/tasks/[uuid]/components/ClinicalSignificanceBadge';
import { InterpretationReadOnlyContext } from '@/app/(main)/tasks/[uuid]/components/InterpretationLock';
import { DEFAULT_FILTER_STATE, VARIANT_TAB_CONFIGS, type TabType, type TableFilterState } from '@/app/(main)/tasks/[uuid]/types';
import { DemoSource, loadDemoManifest, type DemoManifest } from '@/lib/demo/source';
import { workspaceServices, demoWorkspaceContext, demoSample, demoTask } from '@/lib/demo/workspace-source';
import { messages } from './demo-copy';

const Empty = () => <></>;
const denyPermission = () => false;
function PublicUser() { return <span className="px-3 py-2 text-xs text-fg-muted">Demo · Read only</span>; }
function PublicSidebar(props: React.ComponentProps<typeof import('@/components/layout/SidebarNav').SidebarNav>) {
  return <SidebarNavView {...props} path="/tasks/demo" isAdmin={false} isSaaS={false} UserMenu={PublicUser} OrganizationSwitcher={Empty} />;
}
function PublicMobileNavigation() { return <div className="fixed inset-x-0 top-14 z-50 h-[calc(100dvh-3.5rem)] overflow-auto bg-canvas-default"><PublicSidebar collapsed={false} onCollapsedChange={()=>undefined}/></div>; }
function StaticFilters(props:React.ComponentProps<typeof ParquetColumnFilterBarView>) { return <ParquetColumnFilterBarView {...props} taskId={undefined} runtime={undefined}/>; }
function PublicMTInspector(props:React.ComponentProps<typeof import('@/app/(main)/tasks/[uuid]/components/MTDetailPanel').MTDetailPanel>) { return <MTDetailPanelView {...props} MTACMGEditor={Empty}/>; }

function PublicSNVInspector({variant,isOpen,onClose,referenceGenome}:React.ComponentProps<typeof import('@/app/(main)/tasks/[uuid]/components/VariantDetailPanel').VariantDetailPanel>) {
  const t=useText();
  const [section,setSection]=React.useState<InspectorSection>('overview');
  React.useEffect(()=>setSection('overview'),[variant?.id]);
  if(!variant||!isOpen)return null;
  return <WorkspaceInspector label={t('tasks.variantDetails7ca440')} onClose={onClose}>
    <div className="flex items-center justify-between border-b border-border bg-canvas-subtle px-4 py-3"><h3 className="text-base font-medium">{t('tasks.variantDetails7ca440')}</h3><IconActionButton label={t('tasks.close6c14bd')} action="close" variant="ghost" onClick={onClose}/></div>
    <div className="yj-inspector-summary"><strong>{variant.gene}</strong> · {variant.chromosome}:{variant.position}<br/>{variant.ref} → {variant.alt}</div>
    <InspectorTabs id="variant-inspector" value={section} onChange={setSection} sections={['overview','annotation','evidence']} labels={{overview:t('variantAssessment.overview')}}/>
    <div id="variant-inspector-content" role="tabpanel" aria-labelledby={`variant-inspector-${section}`} className="yj-inspector-content"><section hidden={section!=='overview'}><VariantAssessmentOverview variant={variant} onCalculator={()=>undefined}/></section><SNVAnnotationSections variant={variant} section={section} referenceGenome={referenceGenome}/></div>
  </WorkspaceInspector>;
}
function PublicCNVInspector({variant,variantType,isOpen,onClose,referenceId,assessment}:React.ComponentProps<typeof import('@/app/(main)/tasks/[uuid]/components/CNVDetailPanel').CNVDetailPanel>) {
  const t=useText();
  const [section,setSection]=React.useState<InspectorSection>('overview');
  React.useEffect(()=>setSection('overview'),[variant?.id]);
  if(!variant||!isOpen)return null;
  return <WorkspaceInspector label={t('tasks.variantDetails7ca440')} onClose={onClose}>
    <div className="flex items-center justify-between border-b border-border bg-canvas-subtle px-4 py-3"><h3 className="text-base font-medium">{t('tasks.variantDetails7ca440')}</h3><IconActionButton label={t('tasks.close6c14bd')} action="close" variant="ghost" onClick={onClose}/></div>
    <div className="yj-inspector-summary"><strong>{variant.chromosome}:{variant.startPosition}–{variant.endPosition}</strong> · <ClinicalSignificanceBadge value={variant.assessment?.classification}/></div>
    <InspectorTabs id="variant-inspector" value={section} onChange={setSection} sections={['overview','annotation','evidence']}/>
    <div id="variant-inspector-content" role="tabpanel" aria-labelledby={`variant-inspector-${section}`} className="yj-inspector-content"><section hidden={section!=='overview'}><CNVAssessmentOverview variant={variant} assessment={assessment??variant.assessment} onClingen={()=>undefined}/></section><CNVAnnotationSection variant={variant} variantType={variantType} section={section} referenceId={referenceId}/><section hidden={section!=='evidence'}>{Object.entries(variant.annotationValues??{}).filter(([k])=>/Evidence|Section|Score|Reason/.test(k)).map(([key,value])=><InfoItem key={key} label={key} value={value}/>)}</section></div>
  </WorkspaceInspector>;
}

function DemoWorkspace({manifest,engine}:{manifest:DemoManifest;engine:DemoSource}) {
  const {locale}=useLocaleSettings(); const copy=messages[locale]; const t=useText();
  const [tab,setTab]=React.useState<TabType>('overview');
  const [filters,setFilters]=React.useState<Partial<Record<TabType,TableFilterState>>>({});
  const services=React.useMemo(()=>workspaceServices(engine,manifest),[engine,manifest]);
  const context=React.useMemo(()=>demoWorkspaceContext(manifest),[manifest]);
  const sample=React.useMemo(()=>demoSample(manifest),[manifest]);
  const task=React.useMemo(()=>demoTask(manifest),[manifest]);
  const sampleServices=React.useMemo(()=>({getSampleDetail:async()=>sample,updateSampleHpoTerms:async():Promise<never>=>{throw new Error('Read-only demo');}}),[sample]);
  const variant=VARIANT_TAB_CONFIGS.some(item=>item.id===tab);
  const common={taskId:'demo',services,filterState:filters[tab]??DEFAULT_FILTER_STATE,onFilterChange:(state:TableFilterState)=>setFilters(old=>({...old,[tab]:state})),ParquetColumnFilterBar:StaticFilters};
  let content:React.ReactNode;
  if(tab==='overview')content=<ResultOverview context={context} onNavigate={setTab} sample={sample}/>;
  else if(tab==='snv-indel')content=<SNVIndelTabView {...common} referenceGenome={manifest.source.reference} VariantDetailPanel={PublicSNVInspector} IGVViewer={Empty}/>;
  else if(tab==='cnv-exon')content=<CNVExonTabView {...common} referenceId={manifest.source.reference} CNVDetailPanel={PublicCNVInspector}/>;
  else if(tab==='cnv-segment')content=<CNVSegmentTabView {...common} referenceId={manifest.source.reference} CNVDetailPanel={PublicCNVInspector}/>;
  else if(tab==='str')content=<STRTabView {...common} IGVViewer={Empty}/>;
  else if(tab==='mt')content=<MTTabView {...common} MTDetailPanel={PublicMTInspector} IGVViewer={Empty}/>;
  else if(tab==='files')content=<div className="p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{locale==='zh-CN'?'文件':locale==='zh-Hant'?'檔案':locale==='en'?'Files':'Archivos'}</h2><ActionButton action="download" disabled title={copy.disabled}>{copy.download}</ActionButton></div><p className="mb-3 text-xs text-fg-muted">{copy.disabled}</p><table className="w-full text-left text-sm"><tbody>{manifest.files.map(f=><tr className="border-b border-border-subtle" key={f.id}><td className="p-2">{f.file}</td><td>{f.rows.toLocaleString()} {copy.rows}</td><td>{(f.bytes/1024).toFixed(1)} KiB</td><td><ActionButton action="download" disabled title={copy.disabled}>{copy.download}</ActionButton></td></tr>)}</tbody></table></div>;
  else content=<div className="p-6 text-sm text-fg-muted">{copy.absent}</div>;
  return <div className="flex h-full min-h-0 flex-col overflow-hidden"><div className="shrink-0 border-b border-border-subtle bg-canvas-default px-3 pt-2 md:px-4"><TaskHeaderView task={task} compact onBack={()=>setTab('overview')} completionControl={<span className="inline-flex items-center gap-1 text-xs text-fg-muted"><LockKeyhole size={12}/>{copy.readonly}</span>}/><SampleSummaryCardView sample={sample} services={sampleServices}/><div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-fg-muted"><span>{copy.sampled} · {manifest.version} · {copy.noAssessment}</span><ActionButton action="download" size="small" disabled title={copy.disabled}>{copy.download}</ActionButton></div></div><div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 md:px-4 md:pb-4"><div className="min-h-0 flex-1"><ResultTabs activeTab={tab} onTabChange={setTab} variantNavigation={variant&&<VariantTypeNav activeTab={tab} context={context} onTabChange={setTab}/>}><div className={variant?'yj-result-workspace':'h-full overflow-auto'}><div className={variant?'yj-result-content':'h-full'}>{content}</div></div></ResultTabs></div></div></div>;
}

export function DemoBrowser() {
  const {locale}=useLocaleSettings(); const copy=messages[locale];
  const [ready,setReady]=React.useState<{manifest:DemoManifest;engine:DemoSource}>();
  const [attempt,setAttempt]=React.useState(0); const [error,setError]=React.useState(false);
  React.useEffect(()=>{const controller=new AbortController();const engine=new DemoSource();setReady(undefined);setError(false);void(async()=>{const manifest=await loadDemoManifest(controller.signal);await engine.open(manifest);if(!controller.signal.aborted)setReady({manifest,engine});})().catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>{controller.abort();void engine.close();};},[attempt]);
  const tools=<><span className="hidden text-xs text-fg-muted sm:inline">{copy.readonly}</span><select aria-label="Language" className="max-w-32 rounded border border-border-subtle bg-canvas-default px-2 py-1 text-xs" value={locale} onChange={e=>{window.location.href=`/demo?lang=${e.target.value}`;}}>{locales.map(l=><option key={l} value={l}>{localeNames[l]}</option>)}</select><a className="inline-flex items-center gap-1 px-2 text-xs text-fg-muted hover:text-accent-fg" href="https://www.schema-bio.com/"><ArrowLeft size={13}/>{copy.back}</a></>;
  return <PublicResultContext.Provider value={true}><BusinessPermissionContext.Provider value={denyPermission}><InterpretationReadOnlyContext.Provider value={true}><AppShellView path="/tasks/demo" SidebarNav={PublicSidebar} MobileNav={PublicMobileNavigation} BillingDisplay={Empty} SupportDialog={Empty} AnnouncementButton={Empty} AnnouncementBanners={Empty} extraTools={tools}><aside role="note" className="shrink-0 border-b border-accent-subtle bg-accent-subtle/30 px-3 py-2 text-xs leading-relaxed text-fg-default md:px-4">{copy.editionNotice}</aside>{ready?<DemoWorkspace {...ready}/>:<div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-sm text-fg-muted" role={error?'alert':'status'}>{error?copy.error:copy.loading}{error&&<button className="rounded border border-border-default px-3 py-1.5" onClick={()=>setAttempt(n=>n+1)}>{copy.retry}</button>}</div>}</AppShellView></InterpretationReadOnlyContext.Provider></BusinessPermissionContext.Provider></PublicResultContext.Provider>;
}
