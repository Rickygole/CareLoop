export const DEMO_ACCOUNT = {
  email: 'demo@careloop.health',
  password: 'careloop-demo',
  displayName: 'Demo reviewer',
  role: 'Demonstration account',
}

export function matchesDemoAccount(email, password) {
  return (
    String(email || '').trim().toLowerCase() === DEMO_ACCOUNT.email &&
    String(password || '') === DEMO_ACCOUNT.password
  )
}
