import { createClient } from '@supabase/supabase-js'

type RequestLike = { method?: string; headers: Record<string, string | string[] | undefined> }
type ResponseLike = { status: (code: number) => ResponseLike; json: (body: unknown) => void }

// Server-side bridge: validates the existing myShopCare session, then checks the
// central control-plane access record. Service-role keys never reach the browser.
export default async function handler(request: RequestLike, response: ResponseLike) {
  if (request.method !== 'GET') return response.status(405).json({ allowed: false })
  const legacyUrl = process.env.MYSHOPCARE_SUPABASE_URL
  // Some older deployments used the generic name while newer ones use the
  // site-specific name. Try both credentials against the myShopCare Auth
  // project instead of treating a stale first value as a denied user.
  const legacyKeys = [...new Set([
    process.env.MYSHOPCARE_SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    // getUser validates the caller's JWT, so the browser-safe project key is
    // also valid here as a final compatibility fallback.
    process.env.VITE_SUPABASE_ANON_KEY,
  ].filter((value): value is string => Boolean(value)))]
  const controlUrl = process.env.CONTROL_PLANE_SUPABASE_URL
  const controlKey = process.env.CONTROL_PLANE_SUPABASE_SERVICE_ROLE_KEY
  const siteDomain = process.env.CONTROL_PLANE_SITE_DOMAIN
  if (!legacyUrl || !legacyKeys.length || !controlUrl || !controlKey || !siteDomain) return response.status(503).json({ allowed: false, reason: 'Access control is not configured.' })
  const token = String(request.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return response.status(401).json({ allowed: false })
  let user: { email?: string } | null = null
  let sessionVerificationFailed = false
  for (const legacyKey of legacyKeys) {
    const legacy = createClient(legacyUrl, legacyKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await legacy.auth.getUser(token)
    if (error) sessionVerificationFailed = true
    if (data.user) { user = data.user; break }
  }
  if (!user?.email) return response.status(401).json({ allowed: false, reason: sessionVerificationFailed ? 'session_verification_failed' : 'session_email_missing' })
  const control = createClient(controlUrl, controlKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: site, error: siteError } = await control.from('sites').select('id').eq('domain', siteDomain).maybeSingle()
  if (siteError) return response.status(502).json({ allowed: false, reason: 'control_plane_unavailable' })
  if (!site) return response.status(200).json({ allowed: false, reason: 'Project is not registered in the control plane.' })
  // myShopCare uses a separate Auth project. Record the verified account here so
  // the control-plane dashboard can show who is actively using this project.
  // Activity tracking must never prevent a user from reaching their account.
  await control.from('site_activity').insert({
    site_id: site.id,
    event_type: 'signed_in',
    user_email: user.email.toLowerCase(),
    path: '/',
  })
  // Existing myShopCare accounts live in their own Auth project, so the dashboard
  // stores their access by email in project_access. Central-Auth subscriptions
  // remain supported as a fallback for apps migrated to the shared identity.
  const { data: manualAccess, error: manualAccessError } = await control.from('project_access').select('payment_status,access_override').eq('site_id', site.id).ilike('email', user.email).maybeSingle()
  if (manualAccessError) return response.status(502).json({ allowed: false, reason: 'access_record_lookup_failed' })
  let record = manualAccess
  if (!record) {
    const { data: centralUser, error: centralUserError } = await control.from('users').select('id').eq('email', user.email).maybeSingle()
    if (centralUserError) return response.status(502).json({ allowed: false, reason: 'access_record_lookup_failed' })
    if (centralUser) {
      const { data: subscription, error: subscriptionError } = await control.from('subscriptions').select('payment_status,access_override').eq('user_id', centralUser.id).eq('site_id', site.id).maybeSingle()
      if (subscriptionError) return response.status(502).json({ allowed: false, reason: 'access_record_lookup_failed' })
      record = subscription
    }
  }
  const allowed = !!record && record.access_override !== 'paused' && ['active', 'trialing'].includes(record.payment_status)
  const reason = !record ? 'access_record_not_found' : record.access_override === 'paused' ? 'access_is_paused' : 'payment_not_active'
  return response.status(200).json({ allowed, reason: allowed ? undefined : reason })
}
