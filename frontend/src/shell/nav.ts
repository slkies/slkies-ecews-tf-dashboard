/** The rail's contents. One list, so nav and routing cannot disagree. */

export interface NavItem {
  id: string
  label: string
  group: 'Programme' | 'Action' | 'Reference'
  adminOnly?: boolean
  /** Shown to a facility account. A facility account sees only these. */
  facility?: boolean
  /** Shown only to a facility account. */
  facilityOnly?: boolean
}

export const NAV: NavItem[] = [
  { id: 'facility', label: 'Facility home',      group: 'Action', facility: true, facilityOnly: true },
  { id: 'overview', label: 'Overview',           group: 'Programme' },
  { id: 'cascade',  label: 'Cascade',            group: 'Programme' },
  { id: 'deep',     label: 'Deep dive',          group: 'Programme' },
  { id: 'dtc',      label: 'DTC review',         group: 'Programme' },
  { id: 'time',     label: 'Time metrics',       group: 'Programme' },
  { id: 'compare',  label: 'Line list changes',  group: 'Programme' },
  { id: 'worklists', label: 'Worklists',         group: 'Action', facility: true },
  { id: 'search',   label: 'Client search',      group: 'Action', facility: true },
  { id: 'plans',    label: 'Treatment plans',    group: 'Action', facility: true },
  { id: 'adv',      label: 'Advanced analytics', group: 'Action' },
  { id: 'dq',       label: 'Data quality',       group: 'Reference' },
  { id: 'guide',    label: 'Guidelines',         group: 'Reference', facility: true },
  { id: 'method',   label: 'Methodology',        group: 'Reference' },
  { id: 'admin',    label: 'Admin',              group: 'Reference', adminOnly: true },
]

export const GROUPS = ['Programme', 'Action', 'Reference'] as const

/** Who the slim facility view is for (CDC session, 4 Nov 2026): an account
 * scoped to one facility. Admins keep the full dashboard whatever their scope. */
export function isFacilityAccount(me: { role: string; scope_facility: string | null } | null | undefined): boolean {
  return !!me?.scope_facility && me.role !== 'admin'
}

/** The rail for this account. */
export function navFor(me: { role: string; scope_facility: string | null } | null | undefined): NavItem[] {
  const fac = isFacilityAccount(me)
  return NAV.filter((n) => (n.adminOnly ? me?.role === 'admin' : true)
    && (fac ? !!n.facility : !n.facilityOnly))
}

/** Where an account lands on sign-in. */
export function homeFor(me: { role: string; scope_facility: string | null } | null | undefined): string {
  return isFacilityAccount(me) ? 'facility' : 'overview'
}
