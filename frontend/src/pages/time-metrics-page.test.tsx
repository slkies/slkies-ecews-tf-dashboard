/**
 * Time metrics: the four medians, the six timed steps against their targets,
 * the switch-date notice, and the survival milestones. Synthetic figures
 * (src/dev/time-fixture.ts).
 */
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilterProvider } from '@/core/filters'
import { SessionProvider } from '@/core/session'
import { ThemeProvider } from '@/core/theme'
import { KM, TIME, UC } from '@/dev/time-fixture'
import TimeMetricsPage from './time-metrics-page'

const OPTIONS = {
  states: ['Delta'], lgas: [], lga_res: [], facilities: [], age_bands: [], quarters: [],
  fys: [], months: [], plans: [], lga_state: {}, facility_state: {},
}

function mock(time: unknown = TIME) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b, headers: new Headers() })
    if (url.startsWith('/api/me')) return json({ username: 'u', email: 'u@x', name: 'U', role: 'viewer', scope_state: null, scope_facility: null })
    if (url.startsWith('/api/filters')) return json(OPTIONS)
    if (url.startsWith('/api/time-metrics')) return json(time)
    if (url.startsWith('/api/survival')) return json(KM)
    if (url.startsWith('/api/unsupp-curve')) return json(UC)
    return json({})
  }))
}

beforeEach(() => { sessionStorage.setItem('ecews.session', 'token') })
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })

const draw = () => render(<ThemeProvider><SessionProvider><FilterProvider><TimeMetricsPage /></FilterProvider></SessionProvider></ThemeProvider>)

describe('Time metrics page', () => {
  it('shows the four medians, with time to EAC judged against 30 days', async () => {
    mock()
    draw()
    const tiles = await screen.findByRole('region', { name: 'Median times' })
    expect(tiles).toHaveTextContent('25 days')
    expect(tiles).toHaveTextContent('Within 30 days')
    expect(tiles).toHaveTextContent('8 months')
  })

  it('draws every timed step, with the guideline target where one applies', async () => {
    mock()
    draw()
    await screen.findByRole('region', { name: 'Median times' })
    expect(screen.getByRole('img', { name: /Time to EAC start: median 25 days, middle half 9 to 61, target 30/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /ART start to first VL: median 8.7 months.*target 6/ })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /median/ })).toHaveLength(6)
  })

  it('says time to switch cannot be measured', async () => {
    mock()
    draw()
    expect(await screen.findByText('Time to switch cannot be measured yet')).toBeInTheDocument()
  })

  it('reads the survival curve at fixed days, so the figures are on the page', async () => {
    mock()
    draw()
    await screen.findByRole('region', { name: 'Median times' })
    const day90 = screen.getByText('Day 90').parentElement!
    expect(within(day90).getByText(/%$/)).toBeInTheDocument()
  })

  it('copes with a selection that has no timed episodes', async () => {
    mock({})
    draw()
    expect(await screen.findAllByText('No data in this selection.')).toHaveLength(6)
  })
})
