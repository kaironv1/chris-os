import asyncio, json, math, sys, datetime
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
    pg = await ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
    return b, ctx, pg, errs
