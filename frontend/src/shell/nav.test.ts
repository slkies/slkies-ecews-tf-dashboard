import { describe, expect, it } from 'vitest'
import { homeFor, isFacilityAccount, navFor } from './nav'

const ids = (me: Parameters<typeof navFor>[0]) => navFor(me).map((n) => n.id)

describe('the facility view (CDC session, 4 Nov 2026)', () => {
  const facility = { role: 'viewer', scope_facility: 'Delta Facility A' }
  const state = { role: 'viewer', scope_facility: null }
  const admin = { role: 'admin', scope_facility: 'Delta Facility A' }

  it('is for an account scoped to one facility, never an admin', () => {
    expect(isFacilityAccount(facility)).toBe(true)
    expect(isFacilityAccount({ role: 'analyst', scope_facility: 'X' })).toBe(true)
    expect(isFacilityAccount(state)).toBe(false)
    expect(isFacilityAccount(admin)).toBe(false)
    expect(isFacilityAccount(null)).toBe(false)
  })

  it('gives a facility account a short menu and its own home page', () => {
    expect(ids(facility)).toEqual(['facility', 'worklists', 'search', 'plans', 'guide'])
    expect(homeFor(facility)).toBe('facility')
  })

  it('leaves everyone else with the full dashboard and no facility page', () => {
    expect(ids(state)).not.toContain('facility')
    expect(ids(state)).toContain('adv')
    expect(ids(state)).not.toContain('admin')
    expect(ids(admin)).toContain('admin')
    expect(homeFor(state)).toBe('overview')
    expect(homeFor(admin)).toBe('overview')
  })
})
