import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './error-boundary'

function Boom(): never { throw new Error('plans?.find is not a function') }

describe('ErrorBoundary', () => {
  it('does not carry one page’s fault onto the next page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(<ErrorBoundary name="Treatment plans"><Boom /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('Treatment plans could not be displayed')
    rerender(<ErrorBoundary name="Facility home"><p>Facility page</p></ErrorBoundary>)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Facility page')).toBeInTheDocument()
  })
})
