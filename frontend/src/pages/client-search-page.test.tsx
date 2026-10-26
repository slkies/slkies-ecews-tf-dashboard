/**
 * Client search and the record panel: an S/N needs four characters, one match
 * opens the record, the record shows every episode with its worklists and
 * next step, and a client outside the account's area reads as not found.
 * Synthetic clients (src/dev/client-fixture.ts).
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientKey, ClientRecordPage, ClientRecordProvider } from '@/components/client-record'
import { FilterProvider } from '@/core/filters'
import { SessionProvider } from '@/core/session'
import { MATCHES, RECORD } from '@/dev/client-fixture'
import ClientSearchPage from './client-search-page'

const OPTIONS = {
  states: ['Delta'], lgas: [], lga_res: [], facilities: ['Delta Facility A'], age_bands: [], quarters: [],
  fys: [], months: [], plans: [], lga_state: {}, facility_state: {},
}

let urls: string[] = []
function mock(matches = MATCHES, record: unknown = RECORD) {
  urls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url)
    const json = (b: unknown, status = 200) => ({ ok: status < 400, status, json: async () => b, headers: new Headers() })
    if (url.startsWith('/api/me')) return json({ username: 'u', email: 'u@x', name: 'U', role: 'viewer', scope_state: 'Delta', scope_facility: null })
    if (url.startsWith('/api/filters')) return json(OPTIONS)
    if (url.startsWith('/api/client-search')) return json({ n: matches.length, shown: matches.length, limit: 50, clients: matches })
    if (url.startsWith('/api/client/')) return record ? json(record) : json({ detail: 'No client with that S/N in your area.' }, 404)
    return json({})
  }))
}

beforeEach(() => { sessionStorage.setItem('ecews.session', 'token') })
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })

const draw = (ui = <ClientSearchPage />) =>
  render(<SessionProvider><FilterProvider><ClientRecordProvider>{ui}</ClientRecordProvider></FilterProvider></SessionProvider>)

describe('Client search', () => {
  it('needs at least four characters of the S/N before searching', async () => {
    mock()
    draw()
    const find = screen.getByRole('button', { name: 'Find' })
    await userEvent.type(screen.getByLabelText('S/N'), '0.1')
    expect(find).toBeDisabled()
    await userEvent.type(screen.getByLabelText('S/N'), '23')
    expect(find).toBeEnabled()
  })

  it('lists the matches, and a client key opens the record', async () => {
    mock()
    draw()
    await userEvent.type(screen.getByLabelText('S/N'), '23456')
    await userEvent.click(screen.getByRole('button', { name: 'Find' }))
    expect(await screen.findByText('3 clients matched')).toBeInTheDocument()
    expect(urls.some((u) => u === '/api/client-search?q=23456')).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: `Open the record for client ${MATCHES[0]!.sn}` }))
    const panel = await screen.findByRole('dialog')
    expect(await within(panel).findByText('2 failure episodes')).toBeInTheDocument()
  })

  it('goes straight to the record when one client matches', async () => {
    mock([MATCHES[0]!])
    draw()
    await userEvent.type(screen.getByLabelText('S/N'), '0.1234')
    await userEvent.click(screen.getByRole('button', { name: 'Find' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(urls.some((u) => u.startsWith(`/api/client/${encodeURIComponent(MATCHES[0]!.sn)}`))).toBe(true)
  })

  it('will not search by details without a facility and one more detail', () => {
    mock()
    draw()
    expect(screen.getByRole('button', { name: /Find clients/ })).toBeDisabled()
  })
})

describe('Client record', () => {
  it('shows each episode with its EAC progress, outcome, and the next step for its worklist', async () => {
    mock()
    draw(<ClientKey sn={RECORD.sn} />)
    await userEvent.click(screen.getByRole('button', { name: /Open the record/ }))
    const latest = await screen.findByRole('region', { name: 'Episode 2' })
    expect(latest).toHaveTextContent('48,200')
    expect(within(latest).getByText('Session 3')).toHaveTextContent('not done')
    expect(latest).toHaveTextContent('No follow-up VL yet')
    expect(latest).toHaveTextContent('Started EAC but not completed')
    expect(latest).toHaveTextContent('Book the remaining sessions. Three are needed before the repeat VL.')
    const earlier = screen.getByRole('region', { name: 'Episode 1' })
    expect(earlier).toHaveTextContent('Re-suppressed')
  })

  it('says a client outside the area is not found, without saying they exist elsewhere', async () => {
    mock(MATCHES, null)
    draw(<ClientKey sn="0.999999999999" />)
    await userEvent.click(screen.getByRole('button', { name: /Open the record/ }))
    expect(await screen.findByText('No client with that S/N in your area.')).toBeInTheDocument()
  })

  it('is plain text where no record panel is mounted', () => {
    render(<ClientKey sn={RECORD.sn} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByTitle(RECORD.sn)).toBeInTheDocument()
  })
})

describe('Client record as a page', () => {
  it('shows the record full width with a way back to where you came from', async () => {
    mock()
    let back = 0
    render(<SessionProvider><ClientRecordPage sn={RECORD.sn} backLabel="Worklists" onBack={() => { back += 1 }} /></SessionProvider>)
    expect(await screen.findByRole('region', { name: 'Episode 2' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Worklists' }))
    expect(back).toBe(1)
  })

  it('opens through the provider without a side panel when the shell shows records as pages', async () => {
    mock()
    const opened: string[] = []
    render(<SessionProvider><ClientRecordProvider onOpen={(sn) => opened.push(sn)}><ClientKey sn={RECORD.sn} /></ClientRecordProvider></SessionProvider>)
    await userEvent.click(screen.getByRole('button', { name: /Open the record/ }))
    expect(opened).toEqual([RECORD.sn])
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
