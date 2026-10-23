/**
 * Admin: changing a role, deleting an account (confirmed first, never your
 * own), resetting a password, and the upload controls. Synthetic accounts
 * (src/dev/admin-fixture.ts); every write is checked by what was sent.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilterProvider } from '@/core/filters'
import { SessionProvider } from '@/core/session'
import { AUDIT, DIAG, FEEDBACK, ME_EMAIL, UPLOADS, USAGE, USERS } from '@/dev/admin-fixture'
import AdminPage from './admin-page'
import { accessPayload } from './admin-users'

const OPTIONS = {
  states: ['Delta', 'Osun'], lgas: [], lga_res: [], facilities: ['Osun Facility B'], age_bands: [], quarters: [],
  fys: [], months: [], plans: [], lga_state: {}, facility_state: { 'Osun Facility B': 'Osun' },
}

let calls: { url: string; method: string; body?: string }[] = []
function mock() {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ url, method, body: typeof init?.body === 'string' ? init.body : undefined })
    const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b, headers: new Headers() })
    if (method !== 'GET') return json({ ok: true })
    if (url.startsWith('/api/me')) return json({ username: 'admin', email: ME_EMAIL, name: 'Harness Admin', role: 'admin', scope_state: null, scope_facility: null })
    if (url.startsWith('/api/filters')) return json(OPTIONS)
    if (url.startsWith('/api/users')) return json(USERS)
    if (url.startsWith('/api/uploads')) return json(UPLOADS)
    if (url.startsWith('/api/diagnostics')) return json(DIAG)
    if (url.startsWith('/api/usage')) return json(USAGE)
    if (url.startsWith('/api/feedback')) return json(FEEDBACK)
    if (url.startsWith('/api/audit')) return json(AUDIT)
    return json({})
  }))
}

beforeEach(() => { sessionStorage.setItem('ecews.session', 'token') })
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })

const draw = () => render(<SessionProvider><FilterProvider><AdminPage /></FilterProvider></SessionProvider>)
async function openUsers() {
  draw()
  await userEvent.click(await screen.findByRole('tab', { name: 'Users and access' }))
  return (await screen.findByText('Analyst One')).closest('table')!
}
const sent = (method: string, part: string) => calls.filter((c) => c.method === method && c.url.includes(part))

describe('Admin page', () => {
  it('sends the whole access on a role change, so a scope is never lost', () => {
    const viewer = USERS[2]!
    expect(accessPayload(viewer, { role: 'analyst' })).toEqual({ role: 'analyst', scope_state: 'Delta', scope_facility: 'All' })
    const leaver = USERS[3]!
    expect(accessPayload(leaver, { role: 'analyst' })).toEqual({ role: 'analyst', scope_state: 'Osun', scope_facility: 'Osun Facility B' })
    // a new state clears a facility that may not be in it
    expect(accessPayload(leaver, { scope_state: 'Delta' })).toEqual({ role: 'viewer', scope_state: 'Delta', scope_facility: 'All' })
  })

  it('shows a role control on every other row', async () => {
    mock()
    await openUsers()
    expect(screen.getByRole('combobox', { name: 'Role for Viewer Delta' })).toHaveTextContent('Viewer')
    expect(screen.getByRole('combobox', { name: 'Role for Analyst One' })).toHaveTextContent('Analyst')
  })

  it('offers no role control, disable or delete on your own row', async () => {
    mock()
    const table = await openUsers()
    const mine = within(table).getByText('Harness Admin').closest('tr')!
    expect(within(mine).queryByRole('combobox')).toBeNull()
    expect(within(mine).queryByRole('button', { name: /Delete/ })).toBeNull()
    expect(within(mine).getByRole('button', { name: /Reset the password/ })).toBeInTheDocument()
  })

  it('deletes an account only after it is confirmed', async () => {
    mock()
    await openUsers()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Former Staff' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('disable the account instead')
    expect(sent('DELETE', '/api/users/')).toHaveLength(0)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(sent('DELETE', '/api/users/4')).toHaveLength(1))
  })

  it('resets a password, and will not send one shorter than the policy', async () => {
    mock()
    await openUsers()
    await userEvent.click(screen.getByRole('button', { name: 'Reset the password for Analyst One' }))
    const dialog = await screen.findByRole('dialog')
    const save = within(dialog).getByRole('button', { name: 'Reset password' })
    await userEvent.type(within(dialog).getByLabelText('Password'), 'short')
    expect(save).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('button', { name: /Generate/ }))
    expect(save).toBeEnabled()
    await userEvent.click(save)
    await waitFor(() => expect(sent('POST', '/api/users/2/password')).toHaveLength(1))
    expect(JSON.parse(sent('POST', '/api/users/2/password')[0]!.body!).password).toHaveLength(14)
  })

  it('needs a file and a line list date before loading, and never deletes the current snapshot', async () => {
    mock()
    draw()
    expect(await screen.findByRole('button', { name: /Load line list/ })).toBeDisabled()
    const history = (await screen.findByText('broken.xlsx')).closest('table')!
    expect(within(history).getAllByRole('button', { name: /Delete the snapshot/ })).toHaveLength(2)
  })

  it('names the accounts that have never signed in', async () => {
    mock()
    draw()
    await userEvent.click(await screen.findByRole('tab', { name: 'Usage' }))
    expect(await screen.findByText(/new\.starter/)).toBeInTheDocument()
  })
})
