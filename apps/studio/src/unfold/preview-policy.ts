/** Traversal playback is a visualization, not an implicit request to re-cut UVs. */
const NO_EDGES=new Set<string>();
export function previewEdges(target:'source'|'generated'|'stitch'|'repack'|'source-atlas',complete:Set<string>,revealed:Set<string>,live=false):Set<string>{
  return (target==='source'||target==='source-atlas')?NO_EDGES:target==='generated'&&live?revealed:complete;
}
export function seamTarget(kind:'baseline'|'uv-seams'|'auto-large'|'auto-balanced'):'source'|'generated'{
  return kind==='uv-seams'?'source':'generated';
}
