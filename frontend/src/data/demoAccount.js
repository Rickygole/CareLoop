export const DEMO_ACCOUNT = {
  fullName: 'Demo Reviewer',
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

export function matchesDemoSignUp(fullName, email, password) {
  return (
    String(fullName || '').trim() === DEMO_ACCOUNT.fullName &&
    matchesDemoAccount(email, password)
  )
}
