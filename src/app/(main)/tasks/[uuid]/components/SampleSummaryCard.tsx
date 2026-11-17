'use client';
import { getSampleDetail, updateSampleHpoTerms } from '@/lib/samples';
import { SampleSummaryCardView } from './SampleSummaryCardView';
const services={getSampleDetail,updateSampleHpoTerms};
export function SampleSummaryCard(props: Omit<React.ComponentProps<typeof SampleSummaryCardView>, 'services'>) { return <SampleSummaryCardView {...props} services={services} />; }
