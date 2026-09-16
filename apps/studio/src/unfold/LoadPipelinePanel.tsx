import {useEffect,useRef} from 'react';
import {PipelinePanel,type PipelinePanelState} from './pipeline-panel';
import type {LoadPipelineConfig} from './load-pipeline';
export function LoadPipelinePanel({state,onChange,onRun,onCancel}:{state:PipelinePanelState;onChange:(p:LoadPipelineConfig)=>void;onRun:()=>void;onCancel:()=>void}){
 const host=useRef<HTMLDivElement>(null),panel=useRef<PipelinePanel|null>(null),callbacks=useRef({onChange,onRun,onCancel});callbacks.current={onChange,onRun,onCancel};
 useEffect(()=>{if(!host.current)return;const p=new PipelinePanel(v=>callbacks.current.onChange(v),()=>callbacks.current.onRun(),()=>callbacks.current.onCancel());host.current.append(p.element);panel.current=p;return()=>{p.dispose();panel.current=null}},[]);
 useEffect(()=>panel.current?.update(state),[state]);
 return <div ref={host}/>;
}
