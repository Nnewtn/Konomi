"""
Konomi AI — FastAPI backend
Эндпоинты:
  GET  /api/menu      — меню ресторана Gęsi Puch (menu.json)
  GET  /api/weather   — реальная погода Łódź (Open-Meteo) + время суток сервера
  POST /api/chat      — диалог с AI-сомелье (Gemini 1.5 Flash, fallback: rule-engine)
Фронтенд раздаётся этим же сервером из ../frontend (единая точка деплоя).
"""
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

# ------------------------------------------------------------------ menu data
with open(BASE_DIR / "menu.json", encoding="utf-8") as f:
    MENU: list[dict] = json.load(f)
MENU_BY_ID = {d["id"]: d for d in MENU}

# ------------------------------------------------------------------ app & CORS
app = FastAPI(title="Konomi AI API", version="2.0")
_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------ weather
LODZ_LAT, LODZ_LON = 51.7592, 19.4560
_weather_cache: dict = {"ts": 0, "data": None}
WEATHER_TTL = 600  # 10 минут кеш, чтобы не долбить Open-Meteo

WMO_CONDITION = [
    ((0,), "clear"), ((1, 2, 3), "cloudy"), ((45, 48), "fog"),
    ((51, 53, 55, 56, 57), "drizzle"), ((61, 63, 65, 66, 67), "rain"),
    ((71, 73, 75, 77), "snow"), ((80, 81, 82), "rain"),
    ((85, 86), "snow"), ((95, 96, 99), "storm"),
]

def code_to_condition(code: int) -> str:
    for codes, name in WMO_CONDITION:
        if code in codes:
            return name
    return "cloudy"

def time_slot(now: datetime) -> str:
    h = now.hour
    if 6 <= h < 11:
        return "morning"
    if 11 <= h < 16:
        return "lunch"
    if 16 <= h < 23:
        return "evening"
    return "night"

async def fetch_weather() -> dict:
    """Реальная погода Open-Meteo. При любой сетевой ошибке — безопасный фолбэк,
    чтобы интерфейс и ИИ никогда не ломались."""
    now = datetime.now()
    slot = time_slot(now)
    if _weather_cache["data"] and time.time() - _weather_cache["ts"] < WEATHER_TTL:
        cached = dict(_weather_cache["data"])
        cached["time_slot"] = slot
        return cached
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={LODZ_LAT}&longitude={LODZ_LON}"
        "&current=temperature_2m,precipitation,weather_code&timezone=Europe%2FWarsaw"
    )
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            cur = r.json().get("current", {})
            data = {
                "temp": round(cur.get("temperature_2m", 8)),
                "condition": code_to_condition(int(cur.get("weather_code", 3))),
                "precipitation": cur.get("precipitation", 0),
                "city": "Łódź",
                "time_slot": slot,
                "source": "open-meteo",
            }
            _weather_cache.update(ts=time.time(), data=data)
            return data
    except Exception:
        # Фолбэк: сезонный дефолт, приложение продолжает работать
        return {"temp": 8, "condition": "cloudy", "precipitation": 0,
                "city": "Łódź", "time_slot": slot, "source": "fallback"}

# ------------------------------------------------------------------ schemas
class ChatContext(BaseModel):
    lang: str = "ru"
    temp: Optional[int] = None
    condition: Optional[str] = None
    time_slot: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    context: ChatContext = ChatContext()
    history: list[ChatMessage] = []

# ------------------------------------------------------------------ combo engine
def pick_combo(exclude_allergens: set[str] | None = None) -> list[str]:
    """Суп (приоритет согревающим) + фирменное основное + напиток/десерт,
    со строгим уважением аллергенов гостя."""
    ex = exclude_allergens or set()
    ok = lambda d: not ex.intersection(d["allergens"])
    soups = [d for d in MENU if d["category"] == "soup" and ok(d)]
    mains = sorted([d for d in MENU if d["category"] == "main" and ok(d)],
                   key=lambda d: "hit" not in d["tags"])
    drinks = [d for d in MENU if d["category"] in ("beverage", "dessert") and ok(d)]
    if not (soups and mains and drinks):
        return []
    soup = next((d for d in soups if "warming" in d["tags"]), soups[0])
    drink = next((d for d in drinks if d["category"] == "beverage"), drinks[0])
    return [soup["id"], mains[0]["id"], drink["id"]]

# ------------------------------------------------------------------ rule-based fallback
CULTURE = {
    "ru": {
        "kartacze": "**Kartacze** — крупные картофельные клёцки с мясным фаршем. Ближайший родственник — литовские цеппелины.",
        "żurek": "**Żurek** — польский суп на ржаной закваске: кисловатый, сытный, с белой колбасой и яйцом. Представьте «тёплую окрошку».",
        "golonka": "**Golonka** — свиная рулька, запечённая в пиве и мёде. Немецкий Eisbein, но по-польски: слаще и с хреном.",
        "kołduny": "**Kołduny** — миниатюрные пельмешки с гусем в бульоне. По формату — как tortellini in brodo.",
        "kwaśnica": "**Kwaśnica** — горский суп на квашеной капусте. Родственник наших щей, только польский и копчёный.",
    },
    "en": {
        "kartacze": "**Kartacze** are large potato dumplings with minced meat — close cousins of Lithuanian cepelinai.",
        "żurek": "**Żurek** is a Polish sour-rye soup with white sausage and egg — tangy and very warming.",
        "golonka": "**Golonka** is pork knuckle roasted in dark beer and honey — think German Eisbein, Polish style.",
        "kołduny": "**Kołduny** are tiny goose dumplings in clear broth — like tortellini in brodo.",
        "kwaśnica": "**Kwaśnica** is a highlander sauerkraut soup with smoked bacon.",
    },
    "pl": {
        "kartacze": "**Kartacze** — duże kluski ziemniaczane z mięsem, kuzyni litewskich cepelinów.",
        "żurek": "**Żurek** — kwaśna zupa na zakwasie żytnim z białą kiełbasą i jajkiem.",
        "golonka": "**Golonka** — pieczona w ciemnym piwie i miodzie, z chrzanem.",
        "kołduny": "**Kołduny** — małe pierożki z gęsiną w rosole.",
        "kwaśnica": "**Kwaśnica** — góralska zupa na kiszonej kapuście.",
    },
}

def rule_engine(req: ChatRequest) -> dict:
    """Детерминированный сомелье: работает всегда, даже без ключа Gemini."""
    lang = req.context.lang if req.context.lang in ("ru", "en", "pl") else "ru"
    low = req.message.lower()
    no_pork = bool(re.search(r"свин|wieprz|pork", low))
    no_lact = bool(re.search(r"лакто|lacto|mlek|dairy", low))
    no_glut = bool(re.search(r"глют|gluten", low))
    hearty = bool(re.search(r"сытн|hearty|syc|filling|hungry|голод", low))
    fish = bool(re.search(r"рыб|fish|ryb", low))
    wants_combo = bool(re.search(r"combo|комбо|сет|zestaw|set", low))
    m = re.search(r"(\d{2,3})\s*(zł|zl|pln|злот)?", low)
    budget = int(m.group(1)) if m else None

    for key, text in CULTURE[lang].items():
        if key in low:
            dish = next((d for d in MENU if key in d["name"].lower()), None)
            return {"reply": text, "dishes": [dish["id"]] if dish else [], "combo": None, "engine": "rules"}

    excl = set()
    if no_pork: excl.add("pork")
    if no_lact: excl.add("lactose")
    if no_glut: excl.add("gluten")

    if wants_combo:
        ids = pick_combo(excl)
        if ids:
            intro = {"ru": "Собрал сет под сегодняшнюю погоду — скидка 15% при добавлении одним касанием:",
                     "en": "Here is a smart set for today's weather — 15% off, one tap:",
                     "pl": "Zestaw na dzisiejszą pogodę — 15% taniej jednym kliknięciem:"}[lang]
            return {"reply": intro, "dishes": [], "combo": {"ids": ids, "discount": 15}, "engine": "rules"}

    def ok(d):
        if excl.intersection(d["allergens"]): return False
        if budget and d["price"] > budget: return False
        if fish and "fish" not in d["tags"]: return False
        if hearty and d["category"] == "beverage": return False
        return True

    picks = sorted([d for d in MENU if ok(d)], key=lambda d: "hit" not in d["tags"])[:4]
    if not picks:
        reply = {"ru": "Под эти условия ничего не подошло. Попробуйте ослабить одно требование.",
                 "en": "Nothing matches these constraints — try relaxing one.",
                 "pl": "Brak dań — zluzuj jedno kryterium."}[lang]
        return {"reply": reply, "dishes": [], "combo": None, "engine": "rules"}

    parts = []
    if no_pork: parts.append({"ru": "без свинины", "en": "no pork", "pl": "bez wieprzowiny"}[lang])
    if no_lact: parts.append({"ru": "без лактозы", "en": "no lactose", "pl": "bez laktozy"}[lang])
    if no_glut: parts.append({"ru": "без глютена", "en": "gluten-free", "pl": "bezglutenowe"}[lang])
    if budget: parts.append(f"≤ {budget} zł")
    head = {"ru": "Понял вас", "en": "Got it", "pl": "Rozumiem"}[lang]
    label = f" ({', '.join(parts)})" if parts else ""
    reply = f"{head}{label}. " + {"ru": "Вот что я рекомендую:",
                                  "en": "Here is what I recommend:",
                                  "pl": "Oto co polecam:"}[lang]
    return {"reply": reply, "dishes": [d["id"] for d in picks], "combo": None, "engine": "rules"}

# ------------------------------------------------------------------ Gemini
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "").strip()
_gemini_model = None
if GEMINI_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_KEY)
        _gemini_model = genai.GenerativeModel("gemini-1.5-flash")
    except Exception:
        _gemini_model = None  # библиотека не установилась — работаем на rules

def build_system_prompt(ctx: ChatContext) -> str:
    lang = ctx.lang if ctx.lang in ("ru", "en", "pl") else "ru"
    menu_lines = "\n".join(
        f"- id={d['id']} | {d['name']} | {d['category']} | {d['price']} PLN | "
        f"{d['weight']} | allergens={','.join(d['allergens']) or 'none'} | {d['desc'].get(lang, d['desc']['en'])}"
        for d in MENU
    )
    weather_line = (
        f"Current context: {ctx.city if hasattr(ctx,'city') else 'Łódź'}, "
        f"{ctx.temp}°C, {ctx.condition}, time of day: {ctx.time_slot}."
        if ctx.temp is not None else "Weather unknown."
    )
    return f"""You are Konomi AI — an expert AI sommelier of the Polish restaurant "Gęsi Puch" in Łódź.

{weather_line}
Subtly weave weather and time of day into recommendations (e.g. on a cold rainy evening lead with warming Żurek or Rosół and slow-cooked dishes). Never mention "mode" or technical flags.

MENU (recommend ONLY these dishes, never invent others):
{menu_lines}

STRICT RULES:
1. Reply in the guest's language: {lang}.
2. Never recommend a dish containing an allergen the guest excludes (pork, lactose, gluten). This is a safety rule with zero exceptions.
3. Explain Polish dish names through cultural analogies when asked (e.g. kartacze ≈ Lithuanian cepelinai).
4. Be concise, warm and professional. No emojis. Use **bold** for dish names.
5. You may propose ONE combo (soup + main + drink/dessert) with a 10-15% discount when the guest is undecided or asks for a deal.
6. Reply ONLY with valid JSON, no markdown fences:
{{"reply": "<text>", "dishes": ["id", ...], "combo": {{"ids": ["soup_id","main_id","drink_id"], "discount": 15}} or null}}
"dishes" — ids of dishes you mention (max 4) so the UI can render their cards."""

async def gemini_reply(req: ChatRequest) -> dict | None:
    if not _gemini_model:
        return None
    try:
        sys_prompt = build_system_prompt(req.context)
        history = "".join(
            f"{'Guest' if m.role == 'user' else 'Sommelier'}: {m.content}\n"
            for m in req.history[-8:]
        )
        prompt = f"{sys_prompt}\n\nConversation so far:\n{history}Guest: {req.message}\nJSON answer:"
        resp = await _gemini_model.generate_content_async(
            prompt,
            generation_config={"response_mime_type": "application/json", "temperature": 0.6},
        )
        data = json.loads(resp.text)
        # Валидация: только реальные id из меню
        valid = set(MENU_BY_ID)
        data["dishes"] = [i for i in data.get("dishes", []) if i in valid][:4]
        combo = data.get("combo")
        if combo:
            combo["ids"] = [i for i in combo.get("ids", []) if i in valid]
            if len(combo["ids"]) < 2:
                combo = None
        data["combo"] = combo
        data["engine"] = "gemini"
        return data
    except Exception:
        return None  # любая ошибка API/парсинга — честный фолбэк на rules

# ------------------------------------------------------------------ endpoints
@app.get("/api/health")
async def health():
    return {"status": "ok", "ai": "gemini" if _gemini_model else "rules",
            "dishes": len(MENU)}

@app.get("/api/menu")
async def get_menu():
    return {"venue": "Gęsi Puch", "city": "Łódź", "currency": "PLN", "dishes": MENU}

@app.get("/api/weather")
async def get_weather():
    return await fetch_weather()

@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not req.message.strip():
        return JSONResponse({"error": "empty message"}, status_code=400)
    # Сервер сам знает погоду — доверяем ему, а не клиенту
    w = await fetch_weather()
    req.context.temp = w["temp"]
    req.context.condition = w["condition"]
    req.context.time_slot = w["time_slot"]
    result = await gemini_reply(req)
    if result is None:
        result = rule_engine(req)
    return result

# ------------------------------------------------------------------ static frontend
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
