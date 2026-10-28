// Independently deployable; the existing assessment path remains the default.
export const optimizedAssessment = () => process.env.NEXT_PUBLIC_ASSESSMENT_OPTIMIZED === 'true';

export interface AssessmentTiming {phase:string;milliseconds:number;rows?:number}
export function assessmentTimer() {
  const timings:AssessmentTiming[]=[];
  return {timings, start(phase:string) {
    const start=performance.now();
    return (rows?:number)=>{timings.push({phase,milliseconds:performance.now()-start,...(rows===undefined?{}:{rows})});};
  }};
}
