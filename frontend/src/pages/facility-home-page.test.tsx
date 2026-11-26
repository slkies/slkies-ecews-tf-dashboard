import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilterProvider } from '@/core/filters'
import { SessionProvider } from '@/core/session'
import type { Overview } from '@/core/overview'
import FacilityHomePage from './facility-home-page'

const ME = { username: 'f', email: 'f@x', name: 'F', role: 'viewer', scope_state: 'Delta', scope_facility: 'Delta Facility A' }
const row = (sn: string, months: number) => ({
  episode: `${sn}-1`, sn: `${sn}0000000000`, state: 'Delta', lga: null, facility: 'Delta Facility A', sex: 'Female',
  age: 30, art_status: 'Active', idx_vl: 5000, recv_date: null, idx_samp: null, idx_date: null, sessions: 1,
  eac_completed: false, fu_vl: null, fu_samp: null, fu_date: null, still_unsuppressed: true, switched: false,
  months_unsuppressed: months, treatment_plan: null,
})

const OPTIONS = {
  states: ['Delta'], lgas: ['Oshimili South'], lga_res: ['Oshimili South'], facilities: ['Delta Facility A'],
  age_bands: ['20-24'], quarters: ['FY26Q1'], fys: ['FY26'], months: [], plans: ['Continue'], lga_state: {}, facility_state: {},
}
const DQ = [
  { sheet: null, check_name: 'No ART status recorded', severity: 'medium', n_records: 2, detail: 'Cannot be triaged.' },
  { sheet: null, check_name: 'Implausible viral load', severity: 'high', n_records: 1, detail: 'Above any assay range.' },
  { sheet: null, check_name: 'Switch recorded without a switch date', severity: 'clear', n_records: 0, detail: 'No switch date.' },
]

function serve(counts: Record<string, number>, rows = [row('a', 3), row('b', 14), row('c', 9)]) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b, headers: new Headers() })
    if (url.startsWith('/api/me')) return json(ME)
    if (url.startsWith('/api/worklists')) return json(Object.entries(counts).map(([flag, n]) => ({ flag, n })))
    if (url.startsWith('/api/filters')) return json(OPTIONS)
    if (url.startsWith('/api/dq/scoped')) return json(DQ)
    if (url.startsWith('/api/cascade')) return json([])
    if (url.startsWith('/api/feedback')) return json({ ok: true })
    if (url.startsWith('/api/clients')) return json(rows)
    return json({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => { sessionStorage.setItem('ecews.session', 'token') })
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })

// Only the fields the headline cards read; the shell passes the real payload.
const OV = {
  n: 120, clients: 110, in_care: 100, left_care_untested: 20, eac1: 80, eac1_pct: 80, never_eac: 20,
  completed: 60, completed_pct: 75, post_eac_vl: 50, retested: 70, retest_pct: 70, awaiting_retest: 30,
  resuppressed: 40, resupp_pct: 57.1, awaiting_switch: 6, still_unsuppressed: 30, prior_switch: 2,
  switched: 3, switch_eligible: 25,
} as unknown as Overview

const draw = (onOpen = vi.fn(), overview: Overview | null = OV) => {
  render(<SessionProvider><FilterProvider>
    <FacilityHomePage onOpenWorklist={onOpen} overview={overview} />
  </FilterProvider></SessionProvider>)
  return onOpen
}

describe('Facility home', () => {
  it('names the facility and shows the Overview headline cards, with no action list', async () => {
    serve({ eac_incomplete: 4, awaiting_switch: 2 })
    draw()
    expect(await screen.findByRole('heading', { name: 'Delta Facility A' })).toBeInTheDocument()
    const kpis = screen.getByRole('region', { name: 'Headline indicators' })
    for (const t of ['Index cohort', 'Commenced EAC', 'Completed EAC', 'Re-suppressed', 'Awaiting DTC review'])
      expect(within(kpis).getByText(t)).toBeInTheDocument()
    expect(screen.queryByText('Needs action')).toBeNull()
  })

  it('runs filters, headline cards, cascade, then the rest, in that order', async () => {
    serve({ eac_incomplete: 3 })
    draw()
    const cascade = await screen.findByRole('heading', { name: 'The treatment failure cascade' })
    const kpis = screen.getByRole('region', { name: 'Headline indicators' })
    const filters = screen.getByText('Fiscal year')
    const dq = screen.getByText('Data quality at this facility')
    const longest = await screen.findByText(/Longest unsuppressed/)
    const after = (x: Element, y: Element) => !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(after(filters, kpis)).toBe(true)
    expect(after(kpis, cascade)).toBe(true)
    expect(after(cascade, longest)).toBe(true)
    expect(after(longest, dq)).toBe(true)
  })

  it('says so when the filters select no episodes', async () => {
    serve({})
    draw(vi.fn(), { ...OV, n: 0 } as Overview)
    expect(await screen.findByText('No episodes match these filters.')).toBeInTheDocument()
  })

  it('shows the longest-unsuppressed clients from the most urgent list that has any', async () => {
    const f = serve({ eac_incomplete: 3, never_retested: 0, awaiting_switch: 0 })
    draw()
    await screen.findByText(/Longest unsuppressed: started EAC but not completed/)
    expect(f).toHaveBeenCalledWith(expect.stringContaining('/api/clients?flag=eac_incomplete'), expect.anything())
    const months = screen.getAllByText(/\d+ months$/).map((e) => e.textContent)
    expect(months).toEqual(['14 months', '9 months', '3 months'])
  })

  it('shows no longest-unsuppressed card when no urgent list has clients', async () => {
    serve({})
    draw()
    await screen.findByRole('heading', { name: 'The treatment failure cascade' })
    expect(screen.queryByText(/Longest unsuppressed/)).toBeNull()
  })

  it('offers only the filters that mean something inside one facility', async () => {
    serve({})
    draw()
    await screen.findByRole('heading', { name: 'Delta Facility A' })
    for (const f of ['Fiscal year', 'Month', 'LGA (residence)', 'Age band', 'Treatment plan']) expect(screen.getByText(f)).toBeInTheDocument()
    for (const f of ['State', 'LGA (service)', 'Facility']) expect(screen.queryByText(f, { exact: true })).toBeNull()
  })

  it('shows the full cascade under the facility filters', async () => {
    const f = serve({})
    draw()
    expect(await screen.findByRole('heading', { name: 'The treatment failure cascade' })).toBeInTheDocument()
    expect(f).toHaveBeenCalledWith(expect.stringContaining('/api/cascade'), expect.anything())
  })

  it("lists the facility's own data-quality findings, worst first, and leaves out clear checks", async () => {
    const f = serve({})
    draw()
    const card = (await screen.findByText('Data quality at this facility')).closest('[data-slot=card]') as HTMLElement
    await within(card).findByText('Implausible viral load')
    expect(f).toHaveBeenCalledWith(expect.stringContaining('/api/dq/scoped'), expect.anything())
    const names = within(card).getAllByRole('listitem').map((li) => li.textContent)
    expect(names[0]).toContain('Implausible viral load')
    expect(names[1]).toContain('No ART status recorded')
    expect(within(card).queryByText('Switch recorded without a switch date')).toBeNull()
    expect(within(card).getByText(/HQ-HI team/)).toBeInTheDocument()
  })

  it('sends feedback from the page, naming the facility it came from', async () => {
    const f = serve({})
    draw()
    const card = (await screen.findByText('Send feedback')).closest('[data-slot=card]') as HTMLElement
    await userEvent.type(within(card).getByLabelText('What should we know?'), 'The plan column is hard to read.')
    await userEvent.click(within(card).getByRole('button', { name: 'Send' }))
    expect(await within(card).findByRole('status')).toHaveTextContent('Thank you, sent.')
    const call = f.mock.calls.find(([u]) => String(u).startsWith('/api/feedback'))!
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual(
      { message: 'The plan column is hard to read.', page: 'Facility home (Delta Facility A)' })
  })

})
