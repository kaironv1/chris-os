import asyncio, json, math, sys, datetime
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright
URL = (__import__('pathlib').Path(__file__).resolve().parent.parent / 'dist' / 'haltung.html').as_uri()
UV = [1.1, 1.0, 0.9]
UNFOLD = "try { sessionStorage.setItem('chrisos.open', JSON.stringify({ outfit: true, checkin: true, reminders: true, training: true })); } catch (e) {}"
def fixture(base_temp, rain_peak):
    d0 = datetime.date.today()
    times, t, a, p = [], [], [], []
    for day in range(3):
        d = d0 + datetime.timedelta(days=day)
        for h in range(24):
            times.append(f"{d.isoformat()}T{h:02d}:00")
            temp = base_temp + 4*math.sin((h-9)/24*2*math.pi) - day
            t.append(round(temp,1)); a.append(round(temp-3.2,1)); p.append(rain_peak if 12<=h<=16 else 15)
    daily_t = [(d0+datetime.timedelta(days=i)).isoformat() for i in range(3)]
    tmax = [max(t[i*24:(i+1)*24]) for i in range(3)]; tmin = [min(t[i*24:(i+1)*24]) for i in range(3)]
    return {"hourly": {"time": times, "temperature_2m": t, "apparent_temperature": a, "precipitation_probability": p},
            "daily": {"time": daily_t, "weather_code": [61, 3, 2], "temperature_2m_max": tmax, "temperature_2m_min": tmin, "precipitation_probability_max": [rain_peak, 20, 10], "uv_index_max": UV}}
AQ_KEYS = ['european_aqi', 'alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'ragweed_pollen']
WX_KEYS = ['temperature_2m', 'pressure_msl', 'precipitation']
def env_fixture(url, today=None, aq=None, wx=None):
    """Antwort für Wetter, Pollen und Luft je Tag (2.8): stündliche Werte von past_days bis heute oder von start_date
    bis end_date. aq(tag, k) und wx(tag, k) liefern die Tageswerte, k Tage vor heute; die Temperatur schwankt über den
    Tag um 3 Grad um den Tageswert. Ohne Angabe: mildes Wetter, Luft ausreichend, keine Pollenwerte (wie im Winter)."""
    q = parse_qs(urlparse(url).query)
    t0 = today or datetime.date.today()
    if 'start_date' in q:
        a, b = datetime.date.fromisoformat(q['start_date'][0]), datetime.date.fromisoformat(q['end_date'][0])
    else:
        a = t0 - datetime.timedelta(days=int(q.get('past_days', ['0'])[0]))
        b = t0 + datetime.timedelta(days=int(q.get('forecast_days', ['1'])[0]) - 1)
    days = [a + datetime.timedelta(days=i) for i in range((b - a).days + 1)]
    air = 'air-quality' in url
    keys = AQ_KEYS if air else WX_KEYS
    f = (aq if air else wx) or ((lambda d, k: {'european_aqi': 22 + (k % 5) * 4}) if air else
                                 (lambda d, k: {'temperature_2m': 6 + 3 * math.sin(k / 5), 'pressure_msl': 1014 + 4 * math.sin(k / 6), 'precipitation': 0.2 if k % 3 == 0 else 0}))
    H = {'time': [f'{d.isoformat()}T{h:02d}:00' for d in days for h in range(24)]}
    for key in keys:
        H[key] = []
    for d in days:
        v = f(d, (t0 - d).days)
        for h in range(24):
            for key in keys:
                x = v.get(key)
                if key == 'temperature_2m' and x is not None:
                    x = round(x + 3 * math.sin((h - 9) / 24 * 2 * math.pi), 1)
                H[key].append(x)
    return {'hourly': H}
async def env_routes(ctx, today=None, aq=None, wx=None, log=None):
    """Fängt die Abfragen für Wetter, Pollen und Luft ab (nach den Wetter-Routen anmelden, sie gehen vor)."""
    async def answer(route):
        if log is not None:
            log.append(route.request.url)
        await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(env_fixture(route.request.url, today, aq, wx)))
    async def forecast(route):
        if 'past_days=' in route.request.url:
            await answer(route)
        else:
            await route.fallback()
    await ctx.route('https://air-quality-api.open-meteo.com/**', answer)
    await ctx.route('https://archive-api.open-meteo.com/**', answer)
    await ctx.route('https://api.open-meteo.com/**', forecast)
async def setup(p, w=1440, h=900, dark=False, mobile=False, unfold=True):
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, color_scheme='dark' if dark else 'light', has_touch=mobile, is_mobile=mobile, accept_downloads=True)
    if unfold:  # Heute: alle Kacheln offen, damit die Tests an ihre Inhalte kommen (Standard in der App: zu)
        await ctx.add_init_script(UNFOLD)
    async def wx(route):
        u = route.request.url
        lat = float(u.split('latitude=')[1].split('&')[0])
        await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps(fixture(7.5 if lat > 50.19 else 5.5, 60)))
    await ctx.route('https://api.open-meteo.com/**', wx)
    async def geo(route):
        await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps({"results":[{"name":"Musterstadt","latitude":50.2268,"longitude":8.6182,"admin1":"Hessen","country":"Deutschland"}]}))
    await ctx.route('https://geocoding-api.open-meteo.com/**', geo)
    await env_routes(ctx)
    pg = await ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
    return b, ctx, pg, errs
