import { ArrowDown, ArrowUp, Info, Minus } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from 'cn'
import { Sparkline } from '@/components/sparkline'
import { Card, CardContent } from '@/components/ui/card'
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from '@/components/ui/hover-card'
import type { TrendValue } from '@/core/use-trend'

/**
 * Movement against the previous line list. Direction is carried by an arrow
 * and a number as well as colour, and whether "up" is good depends on the
 * indicator - more re-suppression is good, more episodes awaiting DTC is not,
 * and a bigger cohort is neither.
 */
export function TrendChip({ trend, better, since }: {
  trend?: TrendValue | null
  better: 'up' | 'down' | 'neutral'
  since?: string
}) {
  if (!trend || trend.delta == null) return null
  const d = trend.delta
  const flat = d === 0
  const Icon = flat ? Minus : d > 0 ? ArrowUp : ArrowDown
  const good = better === 'neutral' || flat ? null : (d > 0) === (better === 'up')
  const tone = good == null ? 'text-muted-foreground' : good ? 'text-good' : 'text-bad'
  const size = trend.unit === 'pts'
    ? `${Math.abs(d).toFixed(1)} pts`
    : Math.abs(d).toLocaleString('en-GB')
  const said = flat ? 'no change' : `${d > 0 ? 'up' : 'down'} ${size}`
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium tabular-nums', tone)}
          title={since ? `Compared with the line list of ${since}` : undefined}>
      <Icon className="size-3" aria-hidden />
      <span aria-hidden>{flat ? '0' : size}</span>
      <span className="sr-only">{said} since the previous line list</span>
    </span>
  )
}

/**
 * A headline figure with its anatomy: what it is (icon, label, definition on
 * hover), what it is now (value), which way it is moving (sparkline across
 * enrolment quarters, trend against the last line list), and what it is a
 * rate of (the denominator line). Status sits beside the denominator because
 * the two are read together.
 */
export function KpiTile({
  icon: Icon, label, value, definition, sparkline, sparkLabel,
  trend, better = 'up', since, note, status, className, children, hue,
}: {
  /** Which tile tint (1-7, defined in styles/merged-theme.css) colours the icon chip
   *  and sparkline. Identity only - never status, which keeps its own colours. */
  hue?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  icon: typeof Info
  label: string
  value: string
  definition?: ReactNode
  sparkline?: (number | null)[]
  sparkLabel?: string
  trend?: TrendValue | null
  better?: 'up' | 'down' | 'neutral'
  since?: string
  note?: ReactNode
  status?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <Card size="sm" className={cn('gap-2', className)}
          style={hue ? { '--tile': `var(--hue-${hue})` } as CSSProperties : undefined}>
      {/* Compact (22 Oct 2026): icon and label share one row, and the corner
          sparkline is gone - the quarterly trend is in the cascade table. */}
      <CardContent className="flex h-full flex-col gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklch,var(--tile,var(--primary))_14%,transparent)] text-[var(--tile,var(--primary))] [&_svg]:size-4">
              <Icon aria-hidden />
            </span>
            <span>{label}</span>
            {definition && (
              <HoverCard>
                <HoverCardTrigger
                  render={<button type="button" aria-label={`How ${label} is defined`}
                                  className="inline-flex rounded-sm text-muted-foreground/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" />}>
                  <Info className="size-3.5" />
                </HoverCardTrigger>
                <HoverCardContent className="w-72 text-xs leading-relaxed">{definition}</HoverCardContent>
              </HoverCard>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-2xl font-bold tracking-tight proportional-nums">{value}</span>
            <TrendChip trend={trend} better={better} since={since} />
          </div>
          {sparkline && (
            <Sparkline values={sparkline} label={sparkLabel ?? `${label} by enrolment quarter`} />
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          {note && <span className="text-xs text-muted-foreground">{note}</span>}
          {status}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
