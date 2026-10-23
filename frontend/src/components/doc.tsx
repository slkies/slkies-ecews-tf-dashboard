/**
 * Reading pages (Guidelines, Methodology): a measure of about 70 characters,
 * headings that step down, and a callout for the sentence that matters. No
 * inline bold in the running text; emphasis is carried by the callout.
 */
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export function Doc({ eyebrow, title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardContent className="flex max-w-3xl flex-col gap-4 text-sm leading-relaxed text-foreground/90">
        {eyebrow && <span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{eyebrow}</span>}
        <h2 className="text-xl font-semibold tracking-tight text-foreground text-balance">{title}</h2>
        {children}
      </CardContent>
    </Card>
  )
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 text-base font-semibold text-foreground">{children}</h3>
}

export function Callout({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'bad' }) {
  return (
    <p className={cn('rounded-r-lg border-l-4 px-4 py-3 text-foreground',
                     tone === 'bad' ? 'border-bad bg-bad-tint' : 'border-[var(--icon)] bg-[color-mix(in_oklch,var(--icon)_10%,transparent)]')}>
      {children}
    </p>
  )
}

/** A plain two- or three-column reference table. */
export function RefTable({ head, rows, right = [] }: { head: string[]; rows: ReactNode[][]; right?: number[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="text-xs">
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            {head.map((h, i) => <TableHead key={h} className={cn(right.includes(i) && 'text-right')}>{h}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((c, j) => (
                <TableCell key={j} className={cn('whitespace-normal', j === 0 && 'font-medium', right.includes(j) && 'text-right tabular-nums')}>{c}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
