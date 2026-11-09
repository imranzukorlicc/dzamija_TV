#!/usr/bin/env python3
"""
Pravi data/namaz-GODINA.json iz službenih podataka vaktija.ba
(https://github.com/vaktija/vaktija.ba, fajl src/data/vaktija.json).

Računanje je isto kao u njihovom kodu (src/api/vaktija/daily.mjs):
    vrijeme = osnovna_tabela[mjesec][dan] + ispravka_grada[mjesec]
    (+ 1 sat ako je u tom danu ljetno računanje, zona Europe/Sarajevo)

Upotreba:
    python tools/vaktija_to_json.py                      # Novi Pazar, 2026-2028
    python tools/vaktija_to_json.py "Sjenica" 2027 2028  # drugi grad / godine
    python tools/vaktija_to_json.py "Novi Pazar" 2026 --src putanja/do/vaktija.json
"""
import json, sys, datetime as dt, urllib.request
from zoneinfo import ZoneInfo

URL = "https://raw.githubusercontent.com/vaktija/vaktija.ba/master/src/data/vaktija.json"
KEYS = ["sabah", "izlazak", "podne", "ikindija", "aksam", "jacija"]

args = sys.argv[1:]
src = None
if "--src" in args:
    i = args.index("--src"); src = args[i + 1]; del args[i:i + 2]
city = args[0] if args else "Novi Pazar"
years = [int(a) for a in args[1:]] or [2026, 2027, 2028]

if src:
    data = json.load(open(src, encoding="utf-8"))
else:
    data = json.load(urllib.request.urlopen(URL))

loc = data["locations"].index(city)
base = data["vaktija"]["months"]
diff = data["differences"][loc]["months"]
tz = ZoneInfo("Europe/Sarajevo")
UTC = ZoneInfo("UTC")

def is_dst(y, m, d):
    # isto kao moment([y,m,d]).add(3,'h').tz('Europe/Sarajevo').isDST()
    mid = dt.datetime(y, m, d, tzinfo=tz).astimezone(UTC) + dt.timedelta(hours=3)
    return bool(mid.astimezone(tz).dst())

def hhmm(sec):
    sec = int(sec) % 86400
    return f"{sec // 3600:02d}:{sec % 3600 // 60:02d}"

for year in years:
    rows = []
    for m in range(1, 13):
        for d in range(1, 32):
            try:
                dt.date(year, m, d)
            except ValueError:
                continue
            v = base[m - 1]["days"][d - 1]["vakat"]
            add = 3600 if is_dst(year, m, d) else 0
            vals = {KEYS[i]: hhmm(v[i] + diff[m - 1]["vakat"][i] + add) for i in range(6)}
            rows.append((f"{m:02d}-{d:02d}", vals))
    meta = {
        "napomena": "Ključ je datum MM-DD. Vremena HH:MM, lokalno vrijeme (ljetno računanje već uračunato za ovu godinu). Ispravke radite direktno ovdje.",
        "lokacija": city,
        "godina": year,
        "izvor": "vaktija.ba (https://github.com/vaktija/vaktija.ba)"
    }
    out = '{\n  "meta": ' + json.dumps(meta, ensure_ascii=False) + ',\n  "vremena": {\n'
    out += ",\n".join(f'    "{k}": {json.dumps(v)}' for k, v in rows)
    out += "\n  }\n}\n"
    path = f"data/namaz-{year}.json"
    open(path, "w", encoding="utf-8").write(out)
    print(path, len(rows), "dana")
