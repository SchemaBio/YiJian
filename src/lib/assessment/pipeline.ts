// Keep at most two outstanding batches. Consumers run in order so references
// and global candidate selection see exactly the same row ordering.
export function batchPipeline<T>(consume:(batch:T)=>Promise<void>,signal:AbortSignal) {
  let tail=Promise.resolve();
  const pending:Promise<void>[]=[];
  let failure:unknown;
  let failed=false;
  let stopped=false;
  return {
    async push(batch:T) {
      if(signal.aborted)throw new DOMException('Aborted','AbortError');
      if(failed)throw failure;
      const task=tail.then(()=>{if(failed)throw failure;if(stopped||signal.aborted)throw new DOMException('Aborted','AbortError');return consume(batch);});
      // Attach a rejection observer immediately, including while the producer reads.
      tail=task.catch(error=>{failure=error;failed=true;});
      pending.push(task);
      if(pending.length>=2)await pending.shift();
    },
    stop(){stopped=true;},
    async finish(){await tail;if(failed)throw failure;},
  };
}
