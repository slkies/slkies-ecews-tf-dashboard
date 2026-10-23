/**
 * Advanced analytics: the factor callouts and forest plot, the variable table,
 * the risk model's caveat and tiles, the lowest-chance list, and mortality.
 * Synthetic model outputs (src/dev/advanced-fixture.ts).
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilterProvider } from '@/core/filters'
import { SessionProvider } from '@/core/session'
import { ThemeProvider } from '@/core/theme'
import { DD, MORT, RISK } from '@/dev/advanced-fixture'
import AdvancedPage from './advanced-page'

const OPTIONS = {
  states: ['Delta'], lgas: [], lga_res: [], facilities: [], age_bands: [], quarters: [],
  fys: [], months: [], plans: [], lga_state: {}, facility_state: {},
}

function mock(risk: unknown = RISK, dd: unknown = DD) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b, headers: new Headers() })
    if (url.startsWith('/api/me')) return json({ username: 'u', email: 'u@x', name: 'U', role: 'viewer', scope_state: null, scope_facility: null })
    if (url.startsWith('/api/filters')) return json(OPTIONS)
    if (url.startsWith('/api/deep-dive')) return json(dd)
    if (url.startsWith('/api/risk')) return json(risk)
    if (url.startsWith('/api/mortality')) return json(MORT)
    return json({})
  }))
}

beforeEach(() => { sessionStorage.setItem('ecews.session', 'token') })
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })

const draw = () => render(<ThemeProvider><SessionProvider><FilterProvider><AdvancedPage /></FilterProvider></SessionProvider></ThemeProvider>)

describe('Advanced analytics page', () => {
  it('splits the significant factors into protective and focus-here', async () => {
    mock()
    draw()
    await screen.findByRole('region', { name: 'What moves re-suppression' })
    const protective = screen.getByText('Protective: more re-suppression').closest('[data-slot=card]') as HTMLElement
    expect(within(protective).getByText(/Age band: 50\+/)).toBeInTheDocument()
    const focus = screen.getByText('Lower re-suppression: focus here').closest('[data-slot=card]') as HTMLElement
    expect(within(focus).getByText(/Age band: 10-19/)).toBeInTheDocument()
    expect(within(focus).queryByText(/Sex: Male/)).toBeNull()
  })

  it('draws every non-reference effect on the forest plot, in words for a screen reader', async () => {
    mock()
    draw()
    await screen.findByRole('region', { name: 'What moves re-suppression' })
    expect(screen.getByRole('img', { name: /Age band 10-19: adjusted odds ratio 0.47, 95% CI 0.33 to 0.66, significantly lower/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Sex Male: .* not significant/ })).toBeInTheDocument()
    // 1 + 4 + 2 non-reference levels, plus years on ART
    expect(screen.getAllByRole('img', { name: /adjusted odds ratio/ })).toHaveLength(8)
  })

  it('says who is not scored, and lists the lowest chance first', async () => {
    mock()
    draw()
    expect(await screen.findByText(/Clients who left care before a repeat VL are not scored \(341 in this selection\)/)).toBeInTheDocument()
    const list = screen.getByText('Least likely to re-suppress, still awaiting a post-EAC VL').closest('[data-slot=card]') as HTMLElement
    const first = within(list).getAllByRole('row')[1]!
    expect(first).toHaveTextContent('22%')
    await userEvent.click(within(list).getByRole('button', { name: /Chance/ }))
    expect(within(list).getAllByRole('row')[1]).not.toHaveTextContent('22%')
  })

  it('explains a model that could not be fitted', async () => {
    mock({ ok: false, reason: 'Only 40 episodes have a post-EAC result; at least 100 are needed to fit a model.' },
         { ok: false, reason: 'No data.' })
    draw()
    expect(await screen.findByText('The scoring model was not fitted')).toBeInTheDocument()
    expect(screen.getByText('The factor model is not available')).toBeInTheDocument()
  })

  it('shows mortality overall and by EAC completion', async () => {
    mock()
    draw()
    const m = await screen.findByRole('region', { name: 'Mortality' })
    expect(m).toHaveTextContent('0.71%')
    expect(m).toHaveTextContent('18 of 1,653')
  })
})
