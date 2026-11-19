/**
 * Every statement on the Guidelines page is referenced (CDC session, 4 Nov 2026).
 * These tests keep the inline citations and the reference table in step, so a
 * section cannot be cited that the table does not list, or listed and never used.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GuidelinesPage, { SOURCES } from './guidelines-page'

function cited(container: HTMLElement): Set<string> {
  return new Set([...container.querySelectorAll('cite[data-section]')].map((c) => c.getAttribute('data-section')!))
}

describe('GuidelinesPage', () => {
  it('cites only sections the reference table lists', () => {
    const { container } = render(<GuidelinesPage />)
    const listed = new Set(SOURCES.map(([s]) => s))
    for (const s of cited(container)) expect(listed, `§${s} is cited but not listed`).toContain(s)
  })

  it('lists only sections the page cites', () => {
    const { container } = render(<GuidelinesPage />)
    const used = cited(container)
    for (const [s] of SOURCES) expect(used, `§${s} is listed but never cited`).toContain(s)
  })

  it('gives every list item and every Who-needs-EAC band a citation', () => {
    const { container } = render(<GuidelinesPage />)
    // The last step of the four-step list carries the citation for all four.
    const bullets = [...container.querySelectorAll('ul.list-disc > li')]
    expect(bullets.length).toBeGreaterThan(0)
    for (const li of bullets) expect(li.querySelector('cite'), li.textContent!).not.toBeNull()
    expect(screen.getByText(/all such clients should undergo EAC/).querySelector('cite')).not.toBeNull()
  })

  it('says where a rule is the programme’s own rather than the guideline’s', () => {
    render(<GuidelinesPage />)
    expect(screen.getByText('Programme rule, not in the guidelines')).toBeInTheDocument()
  })
})
