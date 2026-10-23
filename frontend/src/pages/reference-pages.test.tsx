/**
 * Data quality, Methodology and the account menu's two dialogs. Synthetic
 * checks (src/dev/admin-fixture.ts).
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangePasswordDialog, FeedbackDialog } from '@/components/account-dialogs'
import { noticesFrom } from '@/components/data-notices'
import { DQ } from '@/dev/admin-fixture'
import DataQualityPage from './data-quality-page'
import GuidelinesPage from './guidelines-page'
import MethodologyPage from './methodology-page'

let calls: { url: string; method: string; body?: string }[] = []
function mock() {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined })
    const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b, headers: new Headers() })
    if (url.startsWith('/api/dq')) return json(DQ)
    if (url.startsWith('/api/summary')) return json({ n: 4633, clients: 4180, as_of: '2026-10-17' })
    return json({ ok: true })
  }))
}

beforeEach(() => { mock() })
afterEach(() => { vi.unstubAllGlobals() })

describe('Data quality page', () => {
  it('leads with the critical issues', async () => {
    render(<DataQualityPage />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('1 critical issue')
    expect(alert).toHaveTextContent('Success-censored follow-up VL')
  })

  it('keeps cohort checks apart from source-file checks, and hides clear ones until asked', async () => {
    render(<DataQualityPage />)
    const cohort = (await screen.findByText('In the assembled cohort')).closest('[data-slot=card]') as HTMLElement
    expect(within(cohort).getByText('Sample drawn before EAC session 1')).toBeInTheDocument()
    expect(within(cohort).queryByText('Success-censored follow-up VL')).toBeNull()
    expect(within(cohort).queryByText('EAC session dates out of order')).toBeNull()
    await userEvent.click(within(cohort).getByRole('button', { name: /Show 1 clear check/ }))
    expect(within(cohort).getByText('EAC session dates out of order')).toBeInTheDocument()
  })
})

describe('Methodology and Guidelines', () => {
  it('counts the second and later failures from the current line list', async () => {
    render(<MethodologyPage />)
    expect(await screen.findByText(/would delete the 453 second/)).toBeInTheDocument()
  })

  it('maps every guideline rule to where it is measured', () => {
    render(<GuidelinesPage />)
    expect(screen.getByText('Cascade steps 2 to 4; completion is sessions 1 to 3 plus 30 days or more since session 3')).toBeInTheDocument()
  })
})

describe('Account menu dialogs', () => {
  it('changes your own password only when the two new entries match', async () => {
    render(<ChangePasswordDialog open onOpenChange={() => {}} />)
    const save = screen.getByRole('button', { name: 'Change password' })
    await userEvent.type(screen.getByLabelText('Current password'), 'Old-Password-1')
    await userEvent.type(screen.getByLabelText('New password'), 'Brand-New-Pass-1')
    await userEvent.type(screen.getByLabelText('New password again'), 'Brand-New-Pass-2')
    expect(screen.getByText('The two entries do not match.')).toBeInTheDocument()
    expect(save).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('New password again'))
    await userEvent.type(screen.getByLabelText('New password again'), 'Brand-New-Pass-1')
    await userEvent.click(save)
    await waitFor(() => expect(calls.some((c) => c.url === '/api/me/password' && c.method === 'POST')).toBe(true))
    expect(JSON.parse(calls.find((c) => c.url === '/api/me/password')!.body!))
      .toEqual({ current_password: 'Old-Password-1', password: 'Brand-New-Pass-1' })
    expect(await screen.findByText('Password changed.')).toBeInTheDocument()
  })

  it('sends feedback with the page it came from', async () => {
    render(<FeedbackDialog open onOpenChange={() => {}} page="Worklists" />)
    await userEvent.type(screen.getByLabelText('What should we know?'), 'The table is crowded.')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(calls.some((c) => c.url === '/api/feedback')).toBe(true))
    expect(JSON.parse(calls.find((c) => c.url === '/api/feedback')!.body!)).toEqual({ message: 'The table is crowded.', page: 'Worklists' })
  })
})

describe('Header data notices', () => {
  it('counts only serious cohort problems, worst first', () => {
    const n = noticesFrom(DQ)
    expect(n.map((r) => r.check_name)).toEqual(['Sample drawn before EAC session 1', 'Implausible viral load'])
  })
})
