/** Bars split by sex, in the one female/male pair used on every page. */
import { useChartPalette } from '@/core/palette'

/** Female, male, then not recorded, with a 2px surface gap between them. */
export function SexSegments({ n, f, m, C }: { n: number; f: number; m: number; C: ReturnType<typeof useChartPalette> }) {
  const u = Math.max(0, n - f - m)
  const w = (v: number) => `${n ? (v / n) * 100 : 0}%`
  const gap = '2px 0 0 0 var(--card)'
  return (
    <>
      <span className="h-full" style={{ width: w(f), background: C.female, boxShadow: m || u ? gap : undefined }} />
      <span className="h-full" style={{ width: w(m), background: C.male, boxShadow: u ? gap : undefined }} />
      {u > 0 && <span className="h-full" style={{ width: w(u), background: C.unknown }} />}
    </>
  )
}

export function SexLegend() {
  const C = useChartPalette()
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>Bars are split by sex:</span>
      {[['Female', C.female], ['Male', C.male], ['Not recorded', C.unknown]].map(([l, c]) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: c }} aria-hidden />{l}
        </span>
      ))}
    </div>
  )
}
