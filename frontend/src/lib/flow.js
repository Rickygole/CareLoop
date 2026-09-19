export const SCREENS = [
  { path: '/', mark: '01', nav: 'Connect', title: 'Connect MyHealth' },
  { path: '/meds', mark: '02', nav: 'Medicines', title: 'Your medicines' },
  { path: '/call', mark: '03', nav: 'The call', title: 'The check-in call' },
  { path: '/decision', mark: '04', nav: 'Decision', title: 'What CareLoop decided' },
  { path: '/evidence', mark: '05', nav: 'Evidence', title: 'How well it holds up' },
]

export function screenIndex(pathname) {
  const path = String(pathname || '/').replace(/\/+$/, '') || '/'
  const found = SCREENS.findIndex((screen) => screen.path === path)
  return found === -1 ? 0 : found
}
