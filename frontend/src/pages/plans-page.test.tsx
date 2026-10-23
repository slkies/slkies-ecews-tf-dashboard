/**
 * Treatment plans: every plan in letter order with its reason, split by sex,
 * and a plan's clients loaded through the server with the plan as a filter.
 * Synthetic counts (src/dev/plans-fixture.ts).
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilterProvider } from '@/core/filters'
import { SessionProvider } from '@/core/session'
import { ThemeProvider } from '@/core/theme'
import { PLAN_ROWS, PLANS } from '@/dev/plans-fixture'
import PlansPage from './plans-page'

const OPTIONS = {
  states: ['Delta'], lgas: [], lga_res: [], facilities: [], age_bands: [], quarters: [],
  fys: [], months: [], plans: [], lga_state: {}, facility_state: {},
}

let urls: string[] = []
function mock(plans: unknown = PLANS) {
  urls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url)
    const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b, headers: new Headers() })
    if (url.startsWith('/api/me')) return json({ username: 'u', email: 'u@x', name: 'U', role: 'viewer', scope_state: null, scope_facility: null })
    if (url.startsWith('/api/filters')) return json(OPTIONS)
    if (url.startsWith('/api/plans')) return json(plans)
    if (url.startsWith('/api/clients')) return json(PLAN_ROWS)
    return json({})
  }))
}

beforeEach(() => { sessionStorage.setItem('ecews.session', 'token') })
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })

const draw = () => render(<ThemeProvider><SessionProvider><FilterProvider><PlansPage /></FilterProvider></SessionProvider></ThemeProvider>)

describe('Treatment plans page', () => {
  it('lists the plans by letter, each with the reason it applies', async () => {
    mock()
    draw()
    const first = await screen.findByRole('button', { name: /no EAC session on record/ })
    expect(first).toHaveTextContent('Commence EAC, update register and EMR')
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent?.[0])).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
  })

  it('gives the sex split in words as well as the bar', async () => {
    mock()
    draw()
    await screen.findAllByRole('row')
    expect(screen.getByText('840 female, 431 male')).toBeInTheDocument()
  })

  it('loads a plan\'s clients through the server, with the plan as a filter', async () => {
    mock()
    draw()
    await userEvent.click(await screen.findByRole('button', { name: /after completed EAC/ }))
    expect(await screen.findAllByText('Facility A')).not.toHaveLength(0)
    expect(urls.some((u) => u.startsWith('/api/clients') && u.includes(`plan=${encodeURIComponent(PLANS[4]!.plan)}`))).toBe(true)
    const card = screen.getByText('Plan F · 412 episodes').closest('[data-slot=card]')!
    expect(within(card as HTMLElement).queryByRole('button', { name: /Export/ })).toBeNull()
  })

  it('copes with a selection that has no episodes', async () => {
    mock([])
    draw()
    expect(await screen.findByText('No episodes in this selection')).toBeInTheDocument()
  })
})
