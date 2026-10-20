# Konomi AI v5 — инструкция перед презентацией

## Обновление действующего ресторана

**Не удаляйте рабочий Volume и не заменяйте БД файлами из архива.** Сначала сохраните согласованную резервную копию `konomi.db` вместе с `encryption.key`. Разворачивайте весь проект: добавлены серверный модуль операций и два клиентских скрипта.

В Railway: файлы архива — в корень репозитория; Volume `/data`; один сервис/одна реплика. `APP_ENV=production`, `COOKIE_SECURE=true`, `ADMIN_PASSWORD` минимум 12 символов при первой инициализации. `PORT` должен совпадать с Target Port. Старые пользовательские Start Command с `$PORT` очистите. Проверка готовности: `/api/ready`, версия: `/api/health` → `5.0.0-service`.

## Перед показом владельцу

1. В `/admin` → «ИИ и настройки» сохраните ключ и выполните проверку соединения. `GEMINI_API_KEY` / `GOOGLE_API_KEY` — резерв при пустом/нерасшифровываемом сохранённом ключе.
2. В меню подтвердите реальные рецептуры и аллергены. Обновление намеренно не объявляет все блюда проверенными и не публикует черновики автоматически.
3. Откройте «Табло заказов», установите PIN зала, включите звук. Стандартного PIN `1111` нет. Сотрудникам безопаснее подтверждать со своего авторизованного устройства; владелец телефона гостя технически может подсмотреть введённый PIN.
4. На телефоне откройте `/?table=5`, напишите «Здравствуйте хочу суп»: язык ответа должен быть русским, карточки — только супы, независимо от языка шапки.
5. Сформируйте чек: он появится на табло в течение очередного двухсекундного опроса, но ещё не войдёт в подтверждённые продажи.
6. Подтвердите PIN на телефоне гостя либо кнопкой «Принять на кухню». Затем «Готово к подаче» → «Выдано / оплачено». Оплата здесь — отметка сотрудника, а не подтверждение эквайринга.
7. В «Продажи и аналитика» проверьте сумму, фильтры столика/периода/статуса и экспорт CSV. Отменённые заказы и неподтверждённые чеки не учитываются как продажи.
8. Выполните настоящие EN/DE/PL/RU диалоги со своим Gemini-ключом и один заказ на реальном Railway-домене. Эти внешние проверки нельзя заменить локальными автотестами.

**Пределы обещаний:** внешняя сеть/Gemini не имеют гарантии доступности 100%; резервный локальный движок обозначается честно. Открытия меню не доказывают физические QR-сканирования. Разница среднего чека с ИИ/без ИИ не доказывает причинный прирост выручки. Состояние `confirmed` не означает подтверждённую оплату.

Автотесты меняют данные: запускайте браузерные сценарии только на отдельной пустой БД, никогда на сервере ресторана. Измеренные результаты — `verification.json`; исходники тестов включены.

---

## Technical reference

# Konomi AI 5.0 — Sommelier · Staff approval · Kitchen · Analytics

FastAPI + SQLite/WAL + Vanilla JS. One origin, one worker, one replica, persistent Volume.
This release upgrades the supplied v4 project. No working secrets or restaurant database are bundled.

## Before updating a working restaurant

1. Back up the **database and encryption.key together** (`python backend/manage.py backup`).
2. Preserve the existing Volume and its data path. Deploy the complete archive, not individual files.
3. Do not replace the working database with menu.json. The JSON is only a first-start seed.
4. First startup creates service/analytics tables and migrates legacy guest checks to `created`, never to sales.
5. Keep a backup of the previous application version. Back up the post-migration database separately before downgrading.
6. Verify `/api/ready`, `/admin`, a test order, PIN/staff approval, the kitchen board, and a live Gemini conversation.

## Railway

Put Dockerfile, railway.json, backend/ and frontend/ in the repository root. Railway Root Directory is that root, not backend/.
Use the Dockerfile builder and the supplied railway.json. Clear old custom start/build commands.
The application code is in `/opt/konomi`; Dockerfile has no VOLUME instruction. Start is handled by `backend/container_entry.py`, which sets data permissions, drops root and starts `serve.py`.

Attach a Railway Volume at `/data`. Do not mount over application code. The app uses RAILWAY_VOLUME_MOUNT_PATH automatically. Keep an existing KONOMI_DATA_DIR only when it correctly names a directory inside your attached Volume.

Variables:

| Name | Meaning |
|---|---|
| ADMIN_USERNAME | `admin`, first database initialization only |
| ADMIN_PASSWORD | Unique password, at least 12 characters; required for first production initialization |
| APP_ENV | `production` |
| COOKIE_SECURE | `true` under HTTPS; `false` only for isolated local HTTP tests |
| PORT | e.g. `8000`; networking Target Port must match it |
| PUBLIC_BASE_URL | Public HTTPS origin for a custom domain |
| GEMINI_API_KEY | Optional environment recovery key |
| GOOGLE_API_KEY | Alternative environment recovery key |
| GEMINI_MODEL | `auto`, unless a specific accessible model is desired |
| HALL_PIN | Optional **first initialization** of staff PIN, 4–8 digits; no default PIN |

Railway public domain is added to allowed origins automatically. For custom origins use PUBLIC_BASE_URL or ALLOWED_ORIGINS. One replica only: SQLite, dialogue locks and part of rate limiting are not a distributed service. For multiple replicas use PostgreSQL and shared coordination.

`GET /api/health` returns release `5.0.0-service`. `GET /api/ready` checks database and mandatory assets without calling Gemini or weather. `/admin`, `/admin/`, `/admin.html` all remain available.

## Local start

Python 3.12 recommended:

```bash
pip install -r backend/requirements.txt
python backend/serve.py
```

Or `sh start.sh` / `start.bat`. Guest menu: http://127.0.0.1:8000; admin: /admin.
For local use copy backend/.env.example to backend/.env. Do not commit it. ADMIN_PASSWORD changes do not reset an existing admin; use the panel or manage.py reset-password.

## Gemini recovery and truthful engine state

API key precedence: decrypted store → GEMINI_API_KEY → GOOGLE_API_KEY. Empty or unreadable ciphertext does not stop environment-key recovery. Ciphertext and provider error bodies are never returned to guests or written to diagnostics.

If encryption.key disappeared beside an existing database and an environment key exists, startup is allowed **without generating a replacement encryption key**. Restore the original file before saving encrypted keys in the panel. Without a recovery key startup stops explicitly rather than silently corrupting stored credentials. Do not rotate encryption.key by deleting it.

Clearing a stored key does not disable an environment fallback. Remove both environment key variables to fully disable external AI.

A failing models.list is not a prerequisite for generation. Attempt chain, without duplicates:
configured model → gemini-2.5-flash → gemini-2.0-flash → gemini-2.5-flash-lite → gemini-1.5-flash-latest.
In auto mode an accessible discovered model is preferred when discovery succeeds. This is the requested compatibility chain, **not a claim that Google still offers every model to every project**. Refresh available models in the panel when needed.

400/404/429/5xx and transport failures can advance to another model. Authorization/compromised-key errors stop immediately. A call has a bounded time budget; endless retries cannot hang the API. Diagnostics retain safe model/status attempts, not secrets.

Markdown/code fences and surrounding explanations are removed from JSON responses. Genuine unwrapped natural-language dialogue responses retain `engine=gemini`. Prices, menu IDs, restrictions, cart changes and staff approval remain server-owned. Typed import/intent consumers do not treat arbitrary prose as a successful extraction.

If all models or the account/network are unavailable, the engine is honestly reported as local. No software can guarantee external API availability or truthfulness of every generated sentence. The UI must not disguise local text as a successful Gemini response.

## Language and deterministic selection

PL/EN/RU changes only UI. `detect_message_language` reads guest text, never UI context. Distinctive scripts, conversational grammar, short phrases and langid are combined. Original dish names alone and ambiguous short acknowledgements may retain the preceding dialogue language. Language detection on ambiguous text is not mathematically perfect.

RU/PL/EN/DE/UK synonyms cover soups, duck/goose/poultry, meat/pork, potato dumplings, fish, light meals, desserts, drinks, warming/cold preferences and budgets. Topic selection is a **hard filter before ranking**. Soup cards are always category=soup, never drinks/desserts. An optional accompanying drink can be mentioned in prose but is not silently added to the soup cards/cart.

“90 PLN for two” is a total shared budget, not 90 each. The result includes an explicit attainable `budget_plan`; recommended cards are alternatives, not a claim that all alternatives fit together. Combo search divides a shared group budget before constructing an individual set.

Unavailable sushi/pizza/etc. redirects to actual safe menu options. Prompt-injection phrases never grant discounts, admin access or cart mutations. The host uses authored dish descriptions; it does not invent apple garnish for a duck whose recipe says plum sauce. Optional selling respects diet, budget and an explicit refusal. Not every safety/decline/error message carries a sales pitch.

Local mode supports authored replies in RU/EN/PL/DE/UK and the existing FR/ES/IT/PT/NL templates. Unknown ingredients, unspecified cooking times, payments or unsupported questions are not guaranteed to be answerable offline. Staff must resolve ambiguity; the system never promises an unrestricted offline general-purpose AI.

## Allergens, drafts and publication — deliberate safety boundary

Startup **does not set every dish to allergens_verified=true or published**. Doing so would turn imported unknown recipes and restaurant stop/draft decisions into false safety promises. Existing verified recipes stay verified, drafts stay drafts, availability is preserved. In the panel, a responsible restaurant employee checks real ingredients and explicitly marks each recipe verified before publication/diet-specific recommendations.

Unknown allergy ingredients block dietary recommendations/order quote until clarification/reset. Cross-contact still requires staff confirmation. Milk allergy and lactose intolerance are not interchangeable. A red kitchen exclusion warning is an instruction to check safety, not a claim that a forbidden ingredient was removed from the recipe.

## Guest → waiter → kitchen

Lifecycle: `created` → `confirmed` → `ready` → `completed`; created/confirmed/ready may be `cancelled`. Completed/cancelled are terminal. A created check is **not a sale**.

### Phone approval

Admin → “Табло заказов” → set a hall PIN (4–8 digits). There is no default 1111. A guest creates a check, shows it to staff, staff chooses “Подтвердить официантом” and enters PIN. The receipt turns green and the persisted kitchen queue changes to confirmed.

PINs are scrypt hashes; they are not returned to the guest/admin browser. Failed attempts persist in SQLite and are throttled. Since the phone belongs to the guest, its owner could inspect entered credentials: prefer the authenticated staff board for higher security and rotate a potentially observed PIN. A PIN is not a personal staff identity.

Receipt status needs a high-entropy capability token, not just a six-digit check code. Capabilities are not put into QR URLs/referrers or public analytics. Guest reload can restore its own receipt from sessionStorage.

### Staff/kitchen board

/admin → “Табло заказов”. Active orders show table, code, waiting time, authoritative line snapshots, total, dietary restrictions and red excluded ingredients. Buttons accept → ready → issued/paid, or reject/spam. The payment label is a **manual staff declaration**, not a POS payment receipt.

Polling every 2 seconds gives near-real-time updates, not zero-latency messaging. A disconnected tab shows stale/connection status and reloads the authoritative database queue on recovery. Orders survive restarts. The sound is opt-in because browsers block autoplay. New pending cards and long waits are visually marked. The board returns at most 500 active orders and warns at capacity.

Approvals use SQLite BEGIN IMMEDIATE and version checks. Double confirmations are idempotent, contradictory simultaneous transitions produce 409 instead of overwriting another employee. Idempotent checkout rejects a changed body with the same key. Legacy GP codes and historical order line names/prices are preserved.

## Honest analytics

/admin → “Продажи и аналитика”. Dashboard refreshes every 10 seconds; board every 2 seconds. Filters: ISO/date-time creation cohort, table; history also filters status. Times are Europe/Warsaw. Order history has pages and CSV export.

- views: deduplicated menu-open events, **not verified physical QR scans**;
- unique visitors: first-party 24-hour browser visitor cookie, not identified people;
- ai_chats: unique visitors who sent a dialogue message, includes a truthful local/Gemini engine classification;
- cart_adds: unique visitors with an addition event, not quantity/revenue;
- checks_created: persisted orders in the creation period;
- confirmed_sales: orders currently confirmed/ready/completed, excluding cancelled.

Metrics intentionally have different units (opens, visitor sessions, orders). This is not a perfectly monotone person-level funnel. Browser telemetry can be blocked/replayed by users; only staff-confirmed financial records are authoritative.

Financial metrics: confirmed value, separately staff-completed value, pending value, AI-assisted vs non-AI average check with sample sizes, combo quantity and accepted upsell conversions present in sold orders. An accepted accompaniment is attributed at most once even if a guest later reorders it; omitted/unsold/cancelled additions are not booked as confirmed upsell sales. No gross margin is invented without costs.

Tables: opens, confirmed count/value. Hour chart: menu opens by Warsaw hour. Dish ranking: sold portions. Demand: explicit dish-name/unique synonym matches and category queries, **not every recommended card**. Filter statistics distinguish UI usage and mentioned dialogue exclusions. Full sales history remains available with all statuses and immutable order line snapshots.

AI participation uses server-side dialogue evidence and visitor events. Average-check comparison is observational, **not proof of incremental revenue or ROI**, because guest groups are not randomized. Confirmed is not equivalent to paid; there is no POS, acquirer or receipt-printer integration in this archive.

## API additions

Public: POST /api/visit, POST /api/events, GET /api/orders/{code} with X-Order-Token, POST /api/orders/{code}/confirm with PIN and access_token.
Staff cookie + existing write guard: GET /api/admin/board, POST /api/admin/orders/{code}/status, GET/PUT /api/admin/hall-pin, GET /api/admin/analytics, GET /api/admin/sales.
Existing menu/chat/import/QR/auth routes remain intact. New implementation is backend/operations.py plus frontend/service-admin.js and service-guest.js; these assets are mandatory build checks.

## Verification and limitations

Run `pip install -r requirements-dev.txt`, then `pytest -q tests/test_api.py tests/test_deploy.py tests/test_dining_v4.py tests/test_service_v5.py` and `python tests/boot_check.py`.
For browser tests install Chromium (`python -m playwright install chromium`, Linux also install-deps) and run tests/browser_service_v5.py, tests/browser_check.py, tests/ui_v4_check.py against **separate empty test data** with Browser-test-password-123. These tests mutate menu/orders and must never run against the restaurant database.

verification.json contains the measured API/deployment result and browser scenario count. External Gemini transport is controlled in automated tests; the application itself has no fake provider. No live Gemini key, Railway account, Docker daemon or physical iOS hardware was supplied. Therefore those live environments are **not claimed as tested**. Before presentation perform the real-key connection test, actual guest-language dialogues and one live staff-approved order in your deployment.

## Storage and privacy

SQLite and encryption.key live together in the private Volume. Backups contain credentials and dietary data: restrict access. Events avoid storing the raw guest question, but dialogue state does store messages/restrictions with a 24-hour activity TTL. Orders/events persist for business reporting; configure an appropriate restaurant retention/privacy policy before production. Do not expose the SQLite file or data directory as static assets. Export menu JSON is not a complete system backup.
