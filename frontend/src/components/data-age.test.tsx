import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataAgeLine, dataAge } from './data-age'

const TODAY = new Date(2026, 10, 4)          // 4 Nov 2026, local time

describe('dataAge', () => {
  it('counts whole calendar days from the line list date', () => {
    expect(dataAge('2026-10-24', TODAY)).toMatchObject({ days: 11, stale: true })
    expect(dataAge('2026-10-24', TODAY)!.label).toBe('Line list of 24 Oct 2026 · 11 days old')
  })

  it('stays neutral for a week, then turns stale', () => {
    expect(dataAge('2026-10-28', TODAY)!.stale).toBe(false)    // 7 days: on schedule
    expect(dataAge('2026-10-27', TODAY)!.stale).toBe(true)     // 8 days: a refresh was missed
  })

  it('reads a timestamp as its date', () => {
    expect(dataAge('2026-11-03T23:30:00', TODAY)!.label).toBe('Line list of 3 Nov 2026 · 1 day old')
    expect(dataAge('2026-11-04', TODAY)!.label).toBe('Line list of 4 Nov 2026 · today')
  })

  it('says nothing rather than guess when the date is missing or unreadable', () => {
    expect(dataAge(null, TODAY)).toBeNull()
    expect(dataAge('', TODAY)).toBeNull()
    expect(dataAge('24 Oct', TODAY)).toBeNull()
  })
})

describe('DataAgeLine', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  function serve(rows: unknown) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => rows }))
  }

  it('shows the current line list, not the latest upload', async () => {
    serve([
      { as_of: '2026-11-01', status: 'failed', is_current: false },
      { as_of: '2026-10-24', status: 'ready', is_current: true },
      { as_of: '2026-08-08', status: 'ready', is_current: false },
    ])
    render(<DataAgeLine today={TODAY} />)
    const line = await screen.findByText(/Line list of 24 Oct 2026/)
    expect(line).toHaveTextContent('11 days old')
    expect(line).toHaveAttribute('data-stale', 'true')
    expect(line).toHaveAttribute('title', expect.stringContaining('a weekly refresh has been missed'))
  })

  it('stays quiet when the list is on schedule', async () => {
    serve([{ as_of: '2026-11-01', status: 'ready', is_current: true }])
    render(<DataAgeLine today={TODAY} />)
    const line = await screen.findByText(/Line list of 1 Nov 2026/)
    expect(line).not.toHaveAttribute('data-stale')
    expect(line).toHaveAttribute('title', expect.stringContaining('not in real time'))
  })

  it('renders nothing when there is no current line list', async () => {
    serve([])
    const { container } = render(<DataAgeLine today={TODAY} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(container).toBeEmptyDOMElement()
  })
})
