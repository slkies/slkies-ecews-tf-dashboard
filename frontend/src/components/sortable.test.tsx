import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { SortHead, useSort } from './sortable'

interface Row { name: string; n: number | null }
const ROWS: Row[] = [{ name: 'Osun B', n: 40 }, { name: 'Delta A', n: null }, { name: 'Ekiti C', n: 120 }]

function Demo() {
  const { sorted, sort, toggle } = useSort(ROWS, (r, k) => r[k as keyof Row])
  return (
    <Table>
      <TableHeader><TableRow>
        <SortHead label="Facility" k="name" sort={sort} onSort={toggle} text />
        <SortHead label="Episodes" k="n" sort={sort} onSort={toggle} align="right" />
      </TableRow></TableHeader>
      <TableBody>{sorted.map((r) => <TableRow key={r.name}><TableCell>{r.name}</TableCell></TableRow>)}</TableBody>
    </Table>
  )
}

const names = () => within(screen.getAllByRole('rowgroup')[1]!).getAllByRole('row').map((r) => r.textContent)

describe('sortable tables', () => {
  it('keeps the given order until a heading is clicked', () => {
    render(<Demo />)
    expect(names()).toEqual(['Osun B', 'Delta A', 'Ekiti C'])
  })

  it('sorts numbers high to low first, then low to high, with blanks always last', async () => {
    const user = userEvent.setup()
    render(<Demo />)
    await user.click(screen.getByRole('button', { name: 'Episodes' }))
    expect(names()).toEqual(['Ekiti C', 'Osun B', 'Delta A'])
    expect(screen.getByRole('button', { name: 'Episodes' }).closest('th')).toHaveAttribute('aria-sort', 'descending')
    await user.click(screen.getByRole('button', { name: 'Episodes' }))
    expect(names()).toEqual(['Osun B', 'Ekiti C', 'Delta A'])
  })

  it('sorts text A-Z first', async () => {
    const user = userEvent.setup()
    render(<Demo />)
    await user.click(screen.getByRole('button', { name: 'Facility' }))
    expect(names()).toEqual(['Delta A', 'Ekiti C', 'Osun B'])
  })
})
