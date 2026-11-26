import verificationSnapshot from './verification-snapshot.json' with { type: 'json' };

const origin = 'https://bibiabdulkareem.github.io';
const graph = 'https://graph.facebook.com/v27.0';
const adPeriods = new Set(['last_30d', 'last_90d', 'maximum']);
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

function response(data, status = 200) {
  return new Response(data === null ? null : JSON.stringify(data), { status, headers });
}

async function readJson(url, requestHeaders) {
  const result = await fetch(url, { headers: requestHeaders, signal: AbortSignal.timeout(8000) });
  if (!result.ok) throw new Error('Upstream request failed');
  return await result.json();
}

async function isAdmin(authorization) {
  const url = Deno.env.get('SUPABASE_URL');
  const apikey = Deno.env.get('SUPABASE_ANON_KEY');
  const requestHeaders = { authorization, apikey };
  const user = await readJson(url + '/auth/v1/user', requestHeaders);
  if (!user.id) return false;
  const query = new URLSearchParams({
    select: 'id', auth_user_id: 'eq.' + user.id, role: 'eq.admin', is_active: 'eq.true', limit: '1',
  });
  const rows = await readJson(url + '/rest/v1/test_employee_access?' + query, requestHeaders);
  return Array.isArray(rows) && rows.length === 1;
}

function dailyValues(payload) {
  const points = payload.data?.[0]?.values;
  if (!Array.isArray(points)) return [];
  return points.filter(point => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.end_time)))
    .map(point => ({ value: point.value, endTime: point.end_time }));
}

async function platformData(platform, token, getMetrics) {
  const snapshot = verificationSnapshot[platform] || null;
  if (!token) return { status: 'credentials_required', snapshot };

  try {
    const read = path => readJson(graph + '/' + path, { Authorization: 'Bearer ' + token });
    const metrics = await getMetrics(read);
    return { status: 'connected', updatedAt: new Date().toISOString(), ...metrics };
  } catch {
    return { status: 'unavailable', snapshot };
  }
}

async function instagram(read) {
  const id = '17841456647091798';
  const [profile, insights] = await Promise.all([
    read(id + '?fields=followers_count'),
    read(id + '/insights?metric=reach&period=day'),
  ]);
  return { followers: Number.isFinite(profile.followers_count) ? profile.followers_count : null, daily: dailyValues(insights) };
}

async function facebook(read) {
  const insights = await read('916250958246919/insights?metric=page_media_view&period=day');
  return { daily: dailyValues(insights) };
}

async function campaigns(read, period) {
  const query = new URLSearchParams({
    level: 'campaign',
    fields: 'campaign_name,account_currency,spend,impressions,clicks,date_start,date_stop',
    date_preset: period,
    limit: '25',
  });
  const insights = await read('act_1468094898365840/insights?' + query);
  if (!Array.isArray(insights.data)) throw new Error('Invalid insights response');
  const numeric = value => /^\d+(\.\d+)?$/.test(String(value)) && Number.isFinite(Number(value)) ? Number(value) : null;
  return {
    period,
    hasMore: Boolean(insights.paging?.next),
    campaigns: insights.data.map(row => ({
      name: row.campaign_name,
      currency: row.account_currency,
      spend: numeric(row.spend),
      impressions: numeric(row.impressions),
      clicks: numeric(row.clicks),
      from: row.date_start,
      to: row.date_stop,
    })),
  };
}

async function whatsappMetrics() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (url !== 'https://fccvnotgsmxirhztveai.supabase.co' || !key) return { status: 'unavailable' };
  try {
    const metrics = await readJson(url + '/rest/v1/rpc/test_meta_whatsapp_metrics', {
      apikey: key, Authorization: 'Bearer ' + key,
    });
    if (!['received', 'awaitingDelivery', 'delivered', 'failed'].every(
      field => Number.isSafeInteger(metrics?.[field]) && metrics[field] >= 0
    )) return { status: 'unavailable' };
    return { status: 'available', ...metrics };
  } catch {
    return { status: 'unavailable' };
  }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return response(null, 204);
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return response({ error: 'unauthorized' }, 401);

  try {
    if (!await isAdmin(authorization)) return response({ error: 'forbidden' }, 403);
  } catch {
    return response({ error: 'unauthorized' }, 401);
  }

  const input = await request.json().catch(() => null);
  const period = adPeriods.has(input?.adPeriod) ? input.adPeriod : 'maximum';
  const [ig, fb, ads, whatsapp] = await Promise.all([
    platformData('instagram', Deno.env.get('PAWAPP_TEST_META_INSTAGRAM_USER_TOKEN'), instagram),
    platformData('facebook', Deno.env.get('PAWAPP_TEST_META_FACEBOOK_PAGE_TOKEN'), facebook),
    platformData('metaAds', Deno.env.get('PAWAPP_TEST_META_ADS_USER_TOKEN'), read => campaigns(read, period)),
    whatsappMetrics(),
  ]);
  return response({ instagram: ig, facebook: fb, metaAds: ads, whatsapp });
});
