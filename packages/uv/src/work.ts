/** Optional instrumentation is separate from serializable solver settings. */
export type UVStage = 'validate'|'topology'|'charts'|'parameterize'|'quality'|'orient'|'pack'|'correspondence'|'hinge'|'transfer';
export interface UVProgress {
  stage:UVStage; detail:string; current?:number; total?:number; unit?:string;
  facesDone?:number; facesTotal?:number; islandsDone?:number;
}
export type UVOperationStep='input'|'extract'|'parameterize'|'repair'|'structure'|'merge'|'pack'|'fill'|'correspondence'|'audit';
export interface UVWork {
  check():void; report(progress:UVProgress):void;
  /** Coarse operation boundaries, separate from nested numerical progress. */
  step?:(id:UVOperationStep)=>void;
}
/** Must propagate through numerical fallbacks rather than start more retries. */
export class UVWorkStopped extends Error {
  constructor(message:string){super(message);this.name='UVWorkStopped';}
}
export function rethrowUVStop(error:unknown):void {if(error instanceof UVWorkStopped)throw error;}
export function uvProgress(work:UVWork|undefined,progress:UVProgress):void {work?.check();work?.report(progress);}
