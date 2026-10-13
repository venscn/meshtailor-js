import { describeFill, describeGrowthStop, type FillReport, type FillGrowthStop } from '@meshtailor/uv';
import { displayPreferences, type Locale } from '@meshtailor/ui-platform';

/** Present measured report fields without localizing machine-readable stop codes
 * or changing the report. The algorithm package remains display-independent. */
export function describeGrowthStopPresentation(reason: FillGrowthStop, locale: Locale = displayPreferences.getSnapshot().locale): string {
  if (locale === 'zh-CN') return describeGrowthStop(reason);
  return {
    'density-limit': 'Island density difference reached its limit',
    'gain-limit': 'Area gain reached its limit',
    'no-fit-found': 'This search found no larger placement',
    'time-budget': 'Search time budget exhausted',
    'trial-budget': 'Placement trial budget exhausted',
    'round-limit': 'Round limit reached',
    'validation-rejected': 'Candidate rejected by validation; not committed',
    'not-tried': 'Growth not attempted yet',
    complete: 'Growth completed for this run',
  }[reason];
}

export function describeFillPresentation(report: FillReport, locale: Locale = displayPreferences.getSnapshot().locale): string {
  if (locale === 'zh-CN') return describeFill(report);
  const stop = {
    converged: 'No acceptable improvement at these directions, resolution, and minimum step (not a global optimum proof)',
    'round-limit': 'Round limit reached', 'trial-budget': 'Trial budget reached', 'time-budget': 'Search time budget reached',
    'raster-no-fit': 'No complete layout without shrinking was found at this resolution',
    'validation-rejected': 'Final validation failed; result rolled back',
  }[report.stop];
  return `Vacancy refinement: ${(report.before*100).toFixed(2)}% → ${(report.after*100).toFixed(2)}%, +${((report.after-report.before)*100).toFixed(2)} percentage points; ${report.trials} trials, ${report.accepted} accepted. `+
    (report.adaptive?`Smaller islands tried after large-island failures: ${report.adaptive.smallerAfterFailure}; local enlargements: ${report.adaptive.localAccepted}. `:'')+
    (report.search?`Completed sweeps: ${report.search.completedSweeps}; untried islands: ${report.search.untriedIds.length}; accepted large-island reflows: ${report.search.reflowAccepted}/${report.search.reflowTrials}. `:'')+
    (report.cavities?.enabled?`Cavity placements: ${report.cavities.windowAccepted}; equal-area relocations: ${report.cavities.relocations}; largest vacancy rectangle ${(report.cavities.largestBefore*100).toFixed(2)}% → ${(report.cavities.largestAfter*100).toFixed(2)}% (conservative raster, not texture occupancy). `:'')+
    (report.growth?`Actually enlarged ${report.growth.enlarged}/${report.growth.rows.length} islands; area gains ${report.growth.minAreaFactor.toFixed(3)}–${report.growth.maxAreaFactor.toFixed(3)}×; ${report.growth.densityLimited} islands density-limited. `:'')+
    `${stop}. Maximum/minimum mean area density: ${report.densitySpreadAfter.toFixed(3)}×.`;
}
