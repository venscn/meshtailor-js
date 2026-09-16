/** Render-only diagnostics. These settings must never enter UV solving or motion timing. */
export type OverlapMode = 'off' | 'auto' | 'coplanar' | 'projected';
export const DEFAULT_OVERLAP_MODE: OverlapMode = 'auto';
/** Near-coincident surfaces within 0.01% of the source model's longest side. */
export const DEFAULT_OVERLAP_TOLERANCE = 1e-4;
export const DEFAULT_OVERLAP_OPACITY = .72;
export const MAX_DIAGNOSTIC_PIXELS = 2_097_152;
export interface OverlapSettings {
  overlapMode?: OverlapMode;
  overlapTolerance?: number;
  overlapOpacity?: number;
  faceTones?: boolean;
}
const finite = (n: number | undefined, fallback: number) => Number.isFinite(n) ? n! : fallback;
export function overlapSettings(s: OverlapSettings) {
  return {
    mode: (['off', 'auto', 'coplanar', 'projected'] as const).includes(s.overlapMode!) ? s.overlapMode! : DEFAULT_OVERLAP_MODE,
    tolerance: Math.max(1e-6, Math.min(.01, finite(s.overlapTolerance, DEFAULT_OVERLAP_TOLERANCE))),
    opacity: Math.max(.1, Math.min(1, finite(s.overlapOpacity, DEFAULT_OVERLAP_OPACITY))),
    faceTones: s.faceTones !== false,
  };
}
/** Bounded buffers: four RGBA8 textures + one depth24 renderbuffer, about 40 MiB max. */
export function diagnosticSize(width: number, height: number, textureLimit = 2048) {
  const w = Math.max(1, Math.floor(finite(width, 1))), h = Math.max(1, Math.floor(finite(height, 1)));
  const limit = Math.max(1, Math.min(2048, Math.floor(finite(textureLimit, 2048))));
  const scale = Math.min(1, limit / Math.max(w, h), Math.sqrt(MAX_DIAGNOSTIC_PIXELS / (w * h)));
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) };
}
export function sourceModelScale(positions: Float32Array): number {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    const v = positions[i]!; if (!Number.isFinite(v)) continue;
    min[i % 3] = Math.min(min[i % 3]!, v); max[i % 3] = Math.max(max[i % 3]!, v);
  }
  const size = Math.max(...min.map((v, i) => max[i]! - v));
  return Number.isFinite(size) && size > 0 ? size : 1;
}
/** Compensate only for the documented 24-bit *linear* depth encoding, not raw depth Z. */
export function overlapWorldTolerance(scale: number, relative: number, far: number) {
  return Math.max(scale * relative, 2 * far / 16777215);
}
export function overlapLegend(mode: OverlapMode) {
  if (mode === 'auto') return '自动叠层：运动岛视线叠层（非几何相交），静止时近共面检查';
  if (mode === 'off') return '重叠提示已关闭';
  const kind = mode === 'projected' ? '视线叠层（含前后遮挡，非几何相交）' : '同岛近共面重叠（当前可见表层）';
  return `${kind} · 橙色斜纹：2 层 · 玫红交叉纹：3 层及以上`;
}
