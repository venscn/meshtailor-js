/** Two-level inspection, independent of which islands are queued for playback.
 * A ray hit identifies a face, but it is NOT permission to select that face.
 * Only an explicit, previous island-selection action grants that permission.
 */
export interface InspectionSelection {
  readonly islands: readonly number[];
  readonly face: number | null;
}
export const EMPTY_INSPECTION: InspectionSelection = { islands: [], face: null };
export interface SelectionHit { id: number; face: number | null; additive?: boolean }
export interface SelectionChange { state: InspectionSelection; kind: 'island' | 'face' | 'none' }

/** Island-list buttons, labels and modifier-clicks only change island selection. */
export function selectInspectionIsland(
  state: InspectionSelection, id: number, all: readonly number[], additive = false,
): InspectionSelection {
  if (!all.includes(id)) return state;
  const islands = additive
    ? state.islands.includes(id) ? state.islands.filter(x => x !== id) : [...state.islands, id]
    : [id];
  return { islands, face: null };
}

/** Pure and shared by the React Studio and offline lab; no camera/time mutations. */
export function resolveInspectionPick(
  state: InspectionSelection, hit: SelectionHit, all: readonly number[], owners: ArrayLike<number>,
): SelectionChange {
  if (!all.includes(hit.id)) return { state, kind: 'none' };
  // Reject stale or malformed face hits instead of highlighting another island.
  if (hit.face !== null && (!Number.isInteger(hit.face) || hit.face < 0 ||
    hit.face >= owners.length || owners[hit.face] !== hit.id)) return { state, kind: 'none' };
  if (hit.additive || hit.face === null || !state.islands.includes(hit.id)) {
    return { state: selectInspectionIsland(state, hit.id, all, hit.additive), kind: 'island' };
  }
  return { state: { islands: state.islands, face: state.face === hit.face ? null : hit.face }, kind: 'face' };
}

/** Escape: clear a triangle first; another Escape clears the explicit islands. */
export function escapeInspection(state: InspectionSelection): InspectionSelection {
  return state.face !== null ? { islands: state.islands, face: null } : EMPTY_INSPECTION;
}
