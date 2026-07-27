import { createClient } from '@supabase/supabase-js'

type RequestLike = { method?: string; headers: Record<string, string | string[] | undefined> }
type ResponseLike = { status: (code: number) => ResponseLike; json: (body: unknown) => void }

// Server-side bridge: validates the existing myShopCare session, then checks the
// central control-plane access record. Service-role keys never reach the browser.
export default async function handler(request: RequestLike, response: ResponseLike) {
  if (request.method !== 'GET') return response.status(405).json({ allowed: false })
  const legacyUrl = process.env.MYSHOPCARE_SUPABASE_URL
  const legacyKey = process.env.MYSHOPCARE_SUPABASE_SERVICE_ROLE_KEY
  const controlUrl = process.env.CONTROL_PLANE_SUPABASE_URL
  const controlKey = process.env.CONTROL_PLANE_SUPABASE_SERVICE_ROLE_KEY
  const siteDomain = process.env.CONTROL_PLANE_SITE_DOMAIN
  if (!legacyUrl || !legacyKey || !controlUrl || !controlKey || !siteDomain) return response.status(503).json({ allowed: false, reason: 'Access control is not configured.' })
  const token = String(request.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return response.status(401).json({ allowed: false })
  const legacy = createClient(legacyUrl, legacyKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: { user } } = await legacy.auth.getUser(token)
  if (!user?.email) return response.status(401).json({ allowed: false })
  const control = createClient(controlUrl, controlKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: site } = await control.from('sites').select('id').eq('domain', siteDomain).maybeSingle()
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
  const { data: manualAccess } = await control.from('project_access').select('payment_status,access_override').eq('site_id', site.id).ilike('email', user.email).maybeSingle()
  let record = manualAccess
  if (!record) {
    const { data: centralUser } = await control.from('users').select('id').eq('email', user.email).maybeSingle()
    if (centralUser) {
      const { data: subscription } = await control.from('subscriptions').select('payment_status,access_override').eq('user_id', centralUser.id).eq('site_id', site.id).maybeSingle()
      record = subscription
    }
  }
  const allowed = !!record && record.access_override !== 'paused' && ['active', 'trialing'].includes(record.payment_status)
  return response.status(200).json({ allowed })
}
