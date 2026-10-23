/**
 * Line list changes: the default pair, the four movement figures, the
 * backwards and back-dated warnings, and the one-list empty state. Synthetic
 * snapshots (src/dev/compare-fixture.ts).
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilterProvider } from '@/core/filters'
import { SessionProvider } from '@/core/session'
import { ThemeProvider } from '@/core/theme'
import { COMPARISON, UPLOADS } from '@/dev/compare-fixture'
import ComparePage from './compare-page'

const OPTIONS = {
  states: ['Delta'], lgas: [], lga_res: [], facilities: [], age_bands: [], quarters: [],
  fys: [], months: [], plans: [], lga_state: {}, facility_state: {},
}

function mock(uploads: unknown = UPLOADS, cmp: unknown = COMPARISON) {
  const f = vi.fn(async (url: string) => {
    const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b, headers: new Headers() })
    if (url.startsWith('/api/me')) return json({ username: 'u', email: 'u@x', name: 'U', role: 'viewer', scope_state: null, scope_facility: null })
    if (url.startsWith('/api/filters')) return json(OPTIONS)
    if (url.startsWith('/api/uploads')) return json(uploads)
    if (url.startsWith('/api/compare')) return json(cmp)
    return json({})
  })
  vi.stubGlobal('fetch', f)
  return f
}

beforeEach(() => { sessionStorage.setItem('ecews.session', 'token') })
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })

const draw = () => render(<ThemeProvider><SessionProvider><FilterProvider><ComparePage /></FilterProvider></SessionProvider></ThemeProvider>)
const compareCalls = (f: ReturnType<typeof mock>) =>
  f.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/api/compare'))

describe('Line list changes page', () => {
  it('compares the newest list with the latest one of a different date, not its re-load', async () => {
    const f = mock()
    draw()
    await screen.findByRole('region', { name: 'Movement between the line lists' })
    expect(compareCalls(f).at(-1)).toMatch(/a=12&b=14$/)
  })

  it('shows the days apart and the episode flow', async () => {
    mock()
    draw()
    const tiles = await screen.findByRole('region', { name: 'Movement between the line lists' })
    expect(tiles).toHaveTextContent('28')
    expect(tiles).toHaveTextContent('4,392')
    expect(tiles).toHaveTextContent('241')
    expect(tiles).toHaveTextContent('Check why')
  })

  it('marks a step that went backwards, and sorts by the change', async () => {
    mock()
    draw()
    const row = (await screen.findByText('Post-EAC VL taken')).closest('tr')!
    expect(within(row).getByText('Went backwards')).toBeInTheDocument()
    expect(within(row).getByText('-14')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Change/ }))
    await waitFor(() => {
      const first = screen.getAllByRole('row')[1]
      expect(first).toHaveTextContent(/Reached session 3|Post-EAC VL taken/)
    })
  })

  it('says so first when the later list is dated earlier', async () => {
    mock(UPLOADS, { ...COMPARISON, back_dated: true, days_between: -28 })
    draw()
    expect(await screen.findByText('The later list is dated earlier')).toBeInTheDocument()
  })

  it('leaves out failed uploads, and needs two lists before comparing', async () => {
    const f = mock([UPLOADS[0], UPLOADS[3]])
    draw()
    expect(await screen.findByText('Only one line list so far')).toBeInTheDocument()
    expect(compareCalls(f)).toHaveLength(0)
  })
})
