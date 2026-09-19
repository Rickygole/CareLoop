export const SCREENS = [
  {
    path: '/',
    mark: '01',
    nav: 'Connect',
    title: 'Connect MyHealth',
    blurb: 'One press, and CareLoop goes and gets your medicines.',
  },
  {
    path: '/meds',
    mark: '02',
    nav: 'Medicines',
    title: 'Your medicines',
    blurb: 'What came back, and the time CareLoop will phone you about each one.',
  },
  {
    path: '/call',
    mark: '03',
    nav: 'The call',
    title: 'The check-in call',
    blurb: 'Hear the call CareLoop makes, and answer it in your own words.',
  },
  {
    path: '/decision',
    mark: '04',
    nav: 'Decision',
    title: 'What CareLoop decided',
    blurb: 'What CareLoop made of your answer and what it did about it.',
  },
  {
    path: '/evidence',
    mark: '05',
    nav: 'Evidence',
    title: 'How well it holds up',
    blurb: 'The test we ran on whether it treats everyone the same.',
  },
]

export function screenIndex(pathname) {
  const path = String(pathname || '/').replace(/\/+$/, '') || '/'
  const found = SCREENS.findIndex((screen) => screen.path === path)
  return found === -1 ? 0 : found
}
