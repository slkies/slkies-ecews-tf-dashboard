import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from 'cn'
import { TableHead } from '@/components/ui/table'

/**
 * Click-to-sort for the small summary tables (facility league, lab queue,
 * quarterly cascade...). The worklists and VL trajectories use the full
 * DataTable; these only need ordering, so this keeps them as plain tables.
 *
 * Numbers sort numerically, text alphabetically, and a blank always sinks to
 * the bottom whichever way the column is sorted.
 */
export type SortDir = 'asc' | 'desc'
export interface SortState { key: string; dir: SortDir }

export function useSort<T>(rows: T[] | undefined, get: (row: T, key: string) => unknown,
                           initial: SortState | null = null) {
  const [sort, setSort] = useState<SortState | null>(initial)
  const list = rows ?? []
  const sorted = !sort ? list : [...list].sort((a, b) => {
    const x = get(a, sort.key), y = get(b, sort.key)
    const nx = x == null || x === '', ny = y == null || y === ''
    if (nx || ny) return nx === ny ? 0 : nx ? 1 : -1
    const c = typeof x === 'number' && typeof y === 'number'
      ? x - y
      : String(x).localeCompare(String(y), 'en-GB', { numeric: true, sensitivity: 'base' })
    return sort.dir === 'asc' ? c : -c
  })
  const toggle = (key: string, firstDir: SortDir = 'desc') => setSort((s) =>
    s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: firstDir })
  return { sorted, sort, toggle }
}

/** A table heading that sorts its column. Text columns start A-Z, numbers high to low. */
export function SortHead({ label, k, sort, onSort, align = 'left', text = false, className }: {
  label: ReactNode
  k: string
  sort: SortState | null
  onSort: (key: string, firstDir?: SortDir) => void
  align?: 'left' | 'right'
  /** A text column: first click sorts A-Z rather than high to low. */
  text?: boolean
  className?: string
}) {
  const on = sort?.key === k
  const Icon = !on ? ArrowUpDown : sort!.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead className={cn(align === 'right' && 'text-right', className)}
               aria-sort={on ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button type="button" onClick={() => onSort(k, text ? 'asc' : 'desc')}
              className={cn('inline-flex items-center gap-1 rounded-sm font-medium hover:text-foreground',
                            'focus-visible:outline-2 focus-visible:outline-ring',
                            align === 'right' && 'flex-row-reverse')}>
        {label}
        <Icon className={cn('size-3.5', on ? 'text-foreground' : 'text-muted-foreground')} aria-hidden />
      </button>
    </TableHead>
  )
}
