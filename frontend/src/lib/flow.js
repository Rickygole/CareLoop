export const TABS = [
  { path: '/', label: 'Today' },
  { path: '/meds', label: 'Medications' },
  { path: '/call', label: 'Check-in' },
  { path: '/appointments', label: 'Appointments' },
  { path: '/safety', label: 'Safety' },
]

const TITLES = {
  '/': 'Today',
  '/meds': 'Medications',
  '/call': 'Check-in',
  '/appointments': 'Appointments',
  '/safety': 'Safety',
  '/connect': 'Connect MyHealth',
  '/decision': 'Check-in summary',
}

export function cleanPath(pathname) {
  return String(pathname || '/').replace(/\/+$/, '') || '/'
}

export function tabIndex(pathname) {
  return TABS.findIndex((tab) => tab.path === cleanPath(pathname))
}

export function sectionTitle(pathname) {
  return TITLES[cleanPath(pathname)] || 'CareLoop'
}
