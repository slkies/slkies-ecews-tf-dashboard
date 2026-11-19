/**
 * Adding several accounts: the list is read, checked by the server, and only
 * then created; first passwords come back once. People and places are made up.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setToken } from '@/core/api'
import { BulkUsersDialog, credentialsCsv, parseList, type BulkRowOut } from './admin-users-bulk'

const out = (row: number, email: string, extra: Partial<BulkRowOut> = {}): BulkRowOut => ({
  row, email, username: email.split('@')[0]!, full_name: `Person ${row}`, role: 'viewer',
  scope_state: 'Ekiti', scope_facility: 'Clinic A', errors: [], ...extra,
})
let bodies: { users: unknown[]; dry_run: boolean }[] = []

function mock(bad = false) {
  bodies = []
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { users: unknown[]; dry_run: boolean }
    bodies.push(body)
    const rows = [out(1, 'ada@example.org'), out(2, 'bola@example.org', bad ? { errors: ["facility 'Nowhere' is not in the current line list"] } : {})]
    const created = !body.dry_run && !bad
    const res = { ok: !bad, created: created ? 2 : 0, errors: bad ? 1 : 0,
      rows: created ? rows.map((r, i) => ({ ...r, password: `Pass-word-${i + 1}xx` })) : rows }
    return { ok: true, status: 200, json: async () => res, headers: new Headers() }
  }))
}
afterEach(() => { vi.unstubAllGlobals(); setToken(null) })

const LIST = 'Full name\tEmail\tRole\tState\tFacility\nAda\tada@example.org\tViewer\tEkiti\tClinic A\n\nBola\tbola@example.org\t\tEkiti\tClinic A\n'

describe('reading a pasted list', () => {
  it('takes rows copied from Excel, skipping the heading and blank lines', () => {
    const rows = parseList(LIST)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ full_name: 'Ada', email: 'ada@example.org', role: 'Viewer', scope_state: 'Ekiti', scope_facility: 'Clinic A' })
    expect(rows[1]!.role).toBe('')
  })

  it('takes a CSV file, keeping a comma inside a quoted facility name', () => {
    const rows = parseList('Ada,ada@example.org,Viewer,Ekiti,"General Hospital, Ado"')
    expect(rows[0]!.scope_facility).toBe('General Hospital, Ado')
  })

  it('writes the created accounts out with their first passwords', () => {
    const csv = credentialsCsv([out(1, 'ada@example.org', { password: 'abc', scope_facility: 'General Hospital, Ado' })])
    expect(csv.split('\r\n')[1]).toBe('Person 1,ada,ada@example.org,viewer,Ekiti,"General Hospital, Ado",abc')
  })
})

describe('Add several users', () => {
  it('checks the list first, then creates the accounts and shows each password once', async () => {
    mock()
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<BulkUsersDialog open onOpenChange={() => {}} onCreated={onCreated} />)
    await user.click(screen.getByLabelText(/Columns, in this order/))
    await user.paste(LIST)
    expect(screen.getByText(/2 rows read/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Check the list' }))
    expect(await screen.findByText(/All 2 rows are ready. Nothing has been saved yet/)).toBeInTheDocument()
    expect(bodies[0]!.dry_run).toBe(true)
    expect(onCreated).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Create 2 accounts' }))
    expect(await screen.findByText('2 accounts created')).toBeInTheDocument()
    expect(bodies[1]!.dry_run).toBe(false)
    expect(screen.getByText('Pass-word-1xx')).toBeInTheDocument()
    expect(screen.getByText(/shown once and cannot be shown again/)).toBeInTheDocument()
    expect(onCreated).toHaveBeenCalledWith(2)
  })

  it('names the row to correct and offers no way to create while one is wrong', async () => {
    mock(true)
    const user = userEvent.setup()
    render(<BulkUsersDialog open onOpenChange={() => {}} onCreated={() => {}} />)
    await user.click(screen.getByLabelText(/Columns, in this order/))
    await user.paste(LIST)
    await user.click(screen.getByRole('button', { name: 'Check the list' }))
    expect(await screen.findByText(/1 of 2 rows need correcting. Nothing has been saved/)).toBeInTheDocument()
    expect(screen.getByText(/facility 'Nowhere' is not in the current line list/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Create/ })).not.toBeInTheDocument()
  })
})
