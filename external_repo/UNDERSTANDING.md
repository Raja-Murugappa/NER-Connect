# NER-Connect — The Plain-Language Guide

This guide explains **what NER-Connect does, how it works, and what every file is for**, in everyday language. You do not need to know how to code to follow it.

> **Where to start:** Read sections 1–4 for the big picture. Sections 5–11 explain each part in detail. Section 12 is a file-by-file map. Section 13 is an honest list of what is real and what is still simulated.

---

## 1. The Problem in One Minute

The North Eastern Region (NER) of India has steep mountain roads, heavy monsoon rain and patchy mobile coverage.

- A single landslide or flood can block a highway for hours or days.
- Trucks carrying medicines, food and building materials get stuck.
- Normal map apps show *where* a road goes. They don't say: *"This stretch near Rangpo is risky today because of heavy rain on a steep slope. Expect a 40-minute delay."*

**NER-Connect is a decision-support tool for logistics operators.** It takes a trip from A to B, cuts the road into sections, checks how risky each section is, and shows the result on a coloured map. It also includes tools for field officers to send geo-tagged photos and for control rooms to alert drivers by SMS.

> It is **not** trying to be Google Maps, and it is **not** trying to predict every landslide in India. It uses information that already exists (maps, elevation, hazard scores) and turns it into *"what does this mean for my truck on this road?"*

---

## 2. The Seven Questions the Project Answers

The whole project is organised around seven simple questions:

| # | Question | Part of the system | Built yet? |
|---|----------|--------------------|-----------|
| 1 | **Where can I go?** | Route Engine | Yes |
| 2 | **What can happen there?** | Risk Intelligence | Yes (partly simulated inputs) |
| 3 | **Where exactly is the problem?** | Road Segmenter | Yes |
| 4 | **Does it affect my current journey?** | Journey Monitor | Simulated (a demo truck, not real vehicle GPS) |
| 5 | **What should I do now?** | Rerouting + Notifications | Yes: reroute options + SMS, operator decides |
| 6 | **Can I reach the driver?** | Communication Layer (SMS) | Yes (demo level) |
| 7 | **If not, what can I pre-load?** | Offline / Pre-cache | Only a "dead zone" warning label so far |

Two more pages sit alongside these seven:

| # | Question | Part of the system | Built yet? |
|---|----------|--------------------|-----------|
| 8 | **Which districts are one landslide away from being cut off?** | District Connectivity | Yes |
| 9 | **Which deliveries are late, rerouted or stuck right now?** | Delivery Status | Yes (mirrors the simulated journey) |

---

## 3. The Two Halves of the Project

NER-Connect has **two programs that work together**:

```text
┌────────────────────────────────────┐          ┌─────────────────────────────────────┐
│  THE WEBSITE  (what people see)    │          │  THE BRAIN  (Python backend)        │
│  Folder: src/   (React)            │  asks →  │  Folder: external_repo/             │
│  Runs on: http://localhost:5173    │ ← answers│  Runs on: http://127.0.0.1:5000     │
│                                    │          │                                     │
│  • Routes: map, options, risk      │          │  • Finds place names on the map     │
│  • Field reports with photos       │          │  • Gets the real road routes        │
│  • SMS alerts to drivers           │          │  • Cuts each road into sectors      │
│                                    │          │  • Scores each sector's risk (AI)   │
└────────────────────────────────────┘          └─────────────────────────────────────┘
```

- **The website** is the dashboard. It has five pages: **Routes**, **Field reports**, **SMS alerts**, **Connectivity**, and **Deliveries**.
- **The brain** does all the route and risk calculation. The website sends it "from Dimapur to Imphal" and gets back the routes, their sectors and their risk.
- **Routes** and **Connectivity** need the brain (both ask it to find real roads). **Field reports**, **SMS alerts** and **Deliveries** work inside the website on their own, using storage in the browser.

> **Rule of thumb:** All route and risk logic lives in **one place**, the Python brain. The website only displays what the brain sends back.

---

## 4. How to Run It

You need **two terminal windows**:

```bash
# Window 1 — start the brain
cd external_repo
python app.py              # → http://127.0.0.1:5000

# Window 2 — start the website (from the main NER-Connect folder)
npm install                # first time only
npm run dev                # → open http://localhost:5173
```

**To send real SMS:** copy `.env.example` to `.env` (in the main NER-Connect folder) and fill in your Twilio account details. Without them, the Twilio option reports "not configured", and "Test mode" still works for demos.

**Other things you can run:**

| Command (inside `external_repo/`) | What it does |
|---|---|
| `python test_run.py` | A text-only demo in the terminal. It asks you for a route and prints the risk cards. |
| `python train_models.py` | Re-teaches the two AI models from the history spreadsheets (see section 6). |

---

## 5. The Journey of One Request (Routes Page)

This is what happens, step by step, when someone types **From: Dimapur** and **To: Imphal** and clicks **Find routes**.

```text
 YOU type "Dimapur" → "Imphal"
        │
        ▼
 ① WEBSITE sends the request to the brain (POST /api/evaluate)
        │
        ▼
 ② FIND THE PLACES ........................ route_engine.py
    "Dimapur" → 25.90°N, 93.72°E   (OpenStreetMap place search)
        │
        ▼
 ③ GET THE REAL ROAD ...................... route_engine.py
    Ask OSRM (free OpenStreetMap routing service) for the driving route.
    → 208 km, thousands of GPS points tracing the actual highway,
      plus a list of junctions and bridges along the way.
        │
        ▼
 ④ CUT THE ROAD INTO SECTORS .............. segmenter.py
    208 km → 3 sectors, each at least 50 km long.
        │
        ▼
 ⑤ SCORE EACH SECTOR ...................... risk_engine.py
    For each sector: how steep? how high? near a river? phone signal?
    → the AI models give a landslide % and a flood %.
        │
        ▼
 ⑥ ADD UP THE TOTALS ...................... app.py / route_options.py
    Total distance, total travel time, a risk summary
    ("High risk on 1 of 3 sectors") and the sector list.
        │
        ▼
 ⑦ WEBSITE shows route A straight away, then asks for OTHER ROUTES
    (POST /api/route-options): real alternative roads, each scored
    the same way (steps ③–⑥). See "Choosing between routes" below.
        │
        ▼
 ⑧ WEBSITE draws the map
    Selected route coloured by sector risk: green low, amber medium, red high
    Other routes: grey dashed lines (click one to select it)
    Markers: dark circle = start, dark square = destination,
             small hollow circle = junction, small square = bridge
    Table: one row per sector with its length, time, elevation and risk.
```

### ② Finding the places (geocoding)

"Geocoding" means turning a name into map coordinates. The brain asks OpenStreetMap's free place-search service (Nominatim). The search is **limited to India**, so "Tezpur" can't accidentally match a place abroad.

Every answer is saved in `data/geocode_cache.json`, so the same name always gives the same point and the brain doesn't ask the internet twice. If a name can't be found, you get a clear message: *"Could not find a location named …"*.

**Tip:** For an unclear name, add the state, e.g. "Kohima, Nagaland".

### ③ Getting the real road (routing)

The brain asks **OSRM**, a free routing service built on OpenStreetMap, for the driving route. It gets back:

- The **exact road shape**: thousands of GPS points along the highway.
- The **distance** and a basic **driving time**.
- **Turn-by-turn steps**. The brain scans these for:
  - **Junctions** (forks, merges, roundabouts, big intersections). These are places where traffic could be diverted.
  - **Bridges**: any step whose road name contains "bridge", "setu", "flyover" or "crossing".

Routes are saved in `data/route_cache.json`, so asking for the same trip twice gives identical results instantly.

**If OSRM can't be reached** (the brain tries twice), it falls back to a **straight line** between the two points. This is clearly flagged: the website shows an amber warning, draws the line dashed, and says *"Approximate Corridor"*. A straight line is never saved to the cache and never presented as a real road.

### ④ Cutting the road into sectors (segmentation)

**Why cut the road at all?** A landslide doesn't block a whole state. It blocks one stretch. If we know *which* stretch, we can warn about that part only and plan around it.

The segmenter decides **how many sectors** there should be with a simple rule:

| Total trip length | Number of sectors |
|---|---|
| up to 65 km | 1 |
| 66 – 120 km | 2 |
| longer | about one sector every 80 km, **minimum 2, maximum 7** |

Then it decides **where to cut**. Instead of cutting at exact kilometre marks, it tries to cut at a meaningful landmark near that mark, in this order of preference:

1. **Checkposts.** There's a built-in list of 8 known NER checkposts, like Rangpo and Jorabat. Police can stop or inform trucks there.
2. **Major junctions.** Places where traffic can be sent a different way.
3. **Bridges.** Places to watch river levels.

**Strict rules:**

- Every sector must be at least **50 km** long.
- The last sector must be at least **35 km** long.

If no landmark fits, it just cuts at the kilometre mark.

The landmark a sector was cut at is shown as **"Ends at …"** (e.g. *"Ends at Sevoke Coronation Gate"*). Named landmarks that fall *inside* a sector are listed as **"Passes …"** (e.g. *"Passes Rangpo Entry Checkpost (km 482.4)"*). Unnamed junctions are left out of the table because they add noise.

The segmenter also asks a free elevation service (Open-Meteo) **how high the start and end of each sector are**, and works out the **slope**. Every sector is a **Highway** sector unless it climbs steeply (slope ≥ 15%, or a rise of 500 m or more), in which case it's a **Mountain climb**.

Elevations that were looked up successfully are saved in `data/elevation_cache.json`, so the same place always gets the same height. **If the elevation service can't be reached**, the table says **"Not available"** for that sector instead of showing a made-up height, and the risk model is given a neutral flat value for it.

### ⑤ Scoring each sector (risk intelligence)

For each sector, the risk engine looks at the sector's **middle point** and gathers facts:

| Fact | Where it comes from |
|---|---|
| Elevation and slope | From step ④ (real elevation data) |
| Distance to the nearest river | Nearest row in `data/terrain.csv` |
| Mobile phone signal | Nearest row in `data/network_quality.csv` |
| **"Upstream hazard score"** (0 to 1). Stands in for a warning from an official agency like ISRO or CWC. | Nearest row in `data/road_segments.csv` |
| Rainfall | **Assumed**: 3 mm normally, 15 mm if the hazard score is above 0.5. See section 13. |
| Soil type | **Guessed from slope**: steep = "Schist Shale", medium = "Loose Phyllite", gentle = "Sandy Clay" |

"Nearest row" means: find the location in the spreadsheet that is geographically closest to this sector, and use its values.

These facts go into **two AI models** (explained in section 6):

- **Landslide model** → e.g. "23% chance".
- **Flood model** → e.g. "8% chance".

The **worse of the two** decides the sector's colour:

| Worst risk | Shown as | Advice |
|---|---|---|
| 50% or more | **High** (red) | Disruption likely. Consider delaying the trip or using another route. |
| 20% – 49% | **Medium** (amber) | Some risk of disruption. Drive slowly and check for updates. |
| under 20% | **Low** (green) | No known problems. |

Risk is always shown as a coloured square **plus a word**, so it doesn't rely on colour alone.

**Travel time for each sector:**

| Slope | Assumed truck speed |
|---|---|
| under 10% | 65 km/h |
| 10% – 19% | 45 km/h |
| 20% or more | 30 km/h |

If either risk is above 50%, the speed is cut to less than half (× 0.45) to allow for delays.

**Confidence:** starts at 98% and goes down as risk goes up, but never below 68%.

**Mobile signal column:** **Good**, **Weak**, or **No signal**. A "No signal" sector is where drivers should get route information *before* they enter it.

### ⑥ The conditions switch

The Routes page has two options under **Conditions**:

- **Normal:** uses the baseline hazard scores from the data.
- **Severe weather warning:** *simulates* an official severe warning (score 0.88, 145 mm rain). It applies only to **mountain sectors**: sectors that are a "Mountain climb", or with any part at **1,000 m or higher**. A route that stays entirely in the plains won't change in this mode.

The brain adds up every sector's travel time to get each route's total time.

### Choosing between routes

The rulebook says the system should **show the options and let the operator choose**, not pick for them (a riskier route may be the right call for an urgent delivery). So the Routes page lists up to **three real road routes**, **Route A, B and C**:

- **Route A** is the main route (usually the fastest). It appears first, as soon as it's calculated.
- **Routes B and C** load a few seconds later. They come from:
  1. alternatives the routing service offers by itself (often none on North East roads), and
  2. routes forced past points **to the left and right of the main road** (about a third and two-thirds of the way along), which makes the routing service use other roads.
- A route is only kept if it uses **at least 30% different road** from Route A, is **at most 60% longer**, and doesn't drive into a dead end and back. Every option is a real road route; nothing is drawn by hand.

Each route shows its **distance, travel time and a risk summary** (e.g. *"High risk on 1 of 3 sectors (57 km)"*), with tags for the **Fastest**, **Shortest** and **Lowest risk** option. Selecting a route (in the list, or by clicking its grey line on the map) switches the map and the sector table to it. The journey simulation (section 7) runs on the selected route.

In tests, **Silchar–Aizawl** and **Dimapur–Imphal** got two alternatives each and **Guwahati–Gangtok** one. **Guwahati–Shillong** and **Tezpur–Tawang** got none: they are essentially single roads, and the page says *"No other road route found between these places."* Results are saved on disk, so a corridor is only slow (about 5–15 seconds) the first time.

---

## 6. How the "AI" Works (No Maths)

The two AI models are small, ordinary machine-learning models. There's no magic in them.

**Step 1 — Look at the past.** `data/landslide_history.csv` has about 2,600 past days. Each row records the rain, slope, elevation, soil, hazard score, and whether a landslide happened (1) or not (0). `data/flood_history.csv` is the same idea for floods, using rain, river level, distance to river and elevation.

**Step 2 — Learn the pattern.** `python train_models.py` reads those rows and learns rules like *"heavy rain + steep slope + high hazard score → landslide likely"*.

The method is called **Gradient Boosting**. Think of it as **100 small yes/no flowcharts** ("Is rain over 80 mm? Is slope over 25%?"). Each one fixes the mistakes of the ones before it, and together they give a probability.

**Step 3 — Save the learning.** The trained models are saved in the `models/` folder so they don't need retraining every time:

| File | What it is |
|---|---|
| `models/landslide_model.joblib` | The trained landslide model |
| `models/flood_model.joblib` | The trained flood model |
| `models/soil_encoder.joblib` | A tiny lookup that turns soil names into numbers, because models only understand numbers |

**Step 4 — Predict.** For each sector, the risk engine gives the models that sector's facts and gets back a percentage.

> **Design principle:** The project does **not** try to build its own weather or landslide forecasting system. The "upstream hazard score" is where a real official warning (ISRO landslide atlas, CWC flood bulletins) would plug in. The models' job is to answer: *given that warning plus this road's local geography, how likely is this road to be disrupted?*

---

## 7. Live Journey & Rerouting (Routes Page)

**The idea:** a route that was safe when the truck left can become blocked on the way. When a disruption is reported, the system checks whether it matters for *this* truck and, if the road ahead is blocked, looks for another way from **where the truck is right now**.

> **Simulation, not live tracking:** there is no real vehicle GPS yet. A blue circle moves along the route to stand in for it. Disruptions are added by hand on the map, standing in for real reports (field officers, agencies).

### How to use it

1. Find routes and select the one you want, then click **Start journey on route A** (or B, C) in the **Journey simulation** box.
2. The truck (a blue circle) drives along the road. The whole trip takes about a minute of playback. Use **Play / Pause**, or drag the **slider** to jump to any point. The road already driven turns **grey**.
3. Under **Report a disruption**, pick the **type** (landslide, flood, bridge closure, road block), the **effect** (road blocked, or slow down only) and the **area** (1, 2 or 5 km radius).
4. For a blocked road, choose the **outcome** (see below).
5. Click **Place on map**, then click the spot on the map. A red square marks the disruption and a red circle shows the affected area.

### Choosing the simulated outcome

Because the journey is a simulation, you can decide what kind of scenario to demonstrate:

| Option | What happens |
|---|---|
| **Real check** | The system searches for a road detour around the spot you clicked. On single-road mountain stretches the honest answer is often "no detour". |
| **Force a reroute** | If your spot has no real detour, the disruption is **moved to the nearest spot ahead that has one**. A hollow grey circle marks where you originally clicked, and the card says it was moved. The detour is always a real road; the system never draws made-up roads. |
| **Force a hold** | Simulates "every detour around here is closed too". No search is done, so it's instant. The card says the outcome was set by the simulation, and the truck is told to hold. |

### What the system decides

| Situation | What you see |
|---|---|
| The disruption isn't near the route | "No impact on this journey". The truck keeps going. |
| It's on a stretch the truck **already passed** | "No action needed". The truck keeps going. |
| It's **ahead**, but only **slow down** | Amber note: reduce speed. The truck keeps going. |
| It's **ahead** and **blocks** the road | The truck pauses, the blocked stretch turns **red and dashed**, and the system looks for alternatives. |

**When the road ahead is blocked:**

1. The brain looks for a **bypass**: a way to leave the road *before* the blockage and rejoin it *after*. It first tries leaving 25 km before and rejoining 25 km after, then widens to 60 km and 120 km if nothing is found.
2. The free routing service can't be told "avoid this area", so the brain also **forces it onto other roads** by asking for routes through "side points" 10 km and 25 km to the left and right of the blockage.
3. It **throws out** any route that still passes through the disruption circle, routes that drive into a dead end and back, and routes far longer than the stretch they replace.
4. Each surviving detour becomes a full new journey (truck → bypass → back on the road → destination). It's **cut into sectors and scored for risk**, exactly like a normal route (section 5).
5. The options (**Detour 1, 2, 3**) are sorted **safest first, then fastest**. The top one is marked **(recommended)**. Each option shows the route km where it leaves and rejoins the current road.

**As soon as the road is confirmed blocked, an SMS is sent automatically** to every **verified driver** (the phone numbers approved on the Twilio trial account — see section 11) — no button needed. The message uses the recommended detour if one was found, or says where to hold if not, the same wording the map and card show. The Journey log records how many were sent and how many failed, and the alert also shows up in the SMS Alerts page's history. This only fires for a genuine blockage, never for a disruption that's behind the truck, off the route, or just a "slow down" caution.

On the map, proposed detours are drawn in **blue**. Blue is deliberately not a risk colour, so a proposal isn't mistaken for a safe or dangerous road. The selected detour is solid, the others are dashed, and a **blue diamond marks where the truck should turn off** the current road.

A card titled **"Road ahead is blocked"** shows each option's risk, remaining distance and time, with the difference from the current route. The **operator decides**; the system never switches routes on its own:

- **Take detour 1:** the truck follows the new route. The given-up part of the old route stays on the map as grey dashes.
- **Keep current route:** the truck carries on as before (for example, if the blockage is expected to clear soon).
- **Send SMS to driver:** for sending again — e.g. after picking a different detour, or to edit the message before sending. Opens the SMS alerts page in a new tab with a ready-made "Reroute" message (or "Road blocked, hold at …" message) filled in. The journey keeps running in the original tab. (The first message already went out automatically, as above.)

**When there is no way around:** mountain roads in the North East often have only one route. In that case the system says so honestly and shows a **hold point** (a red outlined square): the last known checkpost before the disruption, or a safe stop about 2 km before it.

Every step is written to a **Journey log** under the map, e.g. *"14:02 Landslide reported … road blocked … 1 detour found … operator took detour 1"*.

### Good to know

- **How long a search takes:** when a detour exists nearby, usually 5–20 seconds. When none exists, all the wider searches are tried, which can take about a minute on the shared free routing server. The page shows a timer while it waits, and asking again at the same spot within 15 minutes is instant. **Force a hold** is always instant.
- **Where detours exist:** in tests, the plains between Guwahati and Siliguri and the Dimapur–Imphal road had real detours. The mountain stretch just before Gangtok and the Guwahati–Shillong highway usually don't. That matches reality: they're essentially single roads.
- If the routing server can't be reached at all, the card says so ("no detour search was done") instead of claiming no detour exists. Drop the disruption again to retry.
- Detour routes (and Routes B and C at planning time) don't show junction or bridge markers (the extra detail makes the routing server much slower).
- The **extra time** of a detour comes from the risk engine's speeds, not just distance. A longer detour can even be *faster* if it avoids high-risk sectors where the model expects slow driving, and a detour through mountains can add much more time than its extra distance suggests.

---

## 8. The Connectivity Page (which districts are most at risk of being cut off)

**Purpose:** answer a planning question rather than a today's-trip question: *"If one road gets blocked, which districts have no other way in or out?"*

**The idea:** every district in the sample data is compared to **Guwahati**, the region's logistics hub (the same city used as the default starting point for the preset routes on the Routes page). For each district, the system asks: *how many genuinely different real roads connect it to the hub?*

**How it works:**

1. The page lists all **31 sample districts** straight away — this part is free, just names and map coordinates, no calculation needed.
2. Click **Check routes** on a district (or **Check all districts** to go one by one). This does the **same real road search** the Routes page uses to find Route B and C: it asks the routing service for the direct road, then tries to find other real roads that are meaningfully different from it (not just the same road with a slightly different exit).
3. The district is labelled:

| Roads found | Label | Meaning |
|---|---|---|
| 1 | **Single road access** (red) | Lose that one road and the district is completely cut off. |
| 2 | **One backup route** (amber) | There's a second real road, but only one — the district still has a single point of failure. |
| 3 or more | **Multiple routes** (green) | Several genuinely different roads reach the district. |

Because each check is a real search against the routing service (the same cost as finding alternative routes on the Routes page), it's done **one district at a time, on request**, not for all 31 automatically. Checking all of them takes a few minutes the first time; after that, results stay on screen for the session.

**What this is not:** it isn't a live feed of which roads are currently open. It's a structural question — *"how many roads exist at all"* — answered with real map data, updated whenever you re-check.

---

## 9. The Deliveries Page (a log of every simulated trip)

**Purpose:** a simple table of every journey that has been run in the **journey simulation** on the Routes page (section 7), so a control room can see at a glance which "deliveries" are moving, late, rerouted, stuck, or finished — the "delayed deliveries" view the project asks for.

**How it works:** there's no separate form to fill in here. A delivery record is created automatically the moment someone clicks **Start journey** on the Routes page, and it's updated automatically as that journey plays out:

| What happens on the Routes page | Status shown here |
|---|---|
| Journey starts | **In transit** |
| A disruption forces a reroute search that finds a detour | **Delayed** (while the operator decides) |
| Operator picks a detour | **Rerouted** |
| Road is blocked and there's no way around | **Blocked** |
| The simulated truck reaches the destination | **Delivered** |
| Operator ends the journey early | **Ended early** |

Each row shows when the trip started, the corridor, which route (A/B/C) it took, distance, how long it's been running, its status and a short note (e.g. *"Took detour 1: 82 km to go."*). You can filter by status and clear the history.

> **Simulation, not a live fleet feed:** just like the journey simulation itself, this reflects the demo truck, not real vehicle GPS. Records are saved in the browser's local storage, the same way the SMS history is, so they exist on one device only.

---

## 10. The Field Reports Page (for field officers)

**Purpose:** let road inspectors and officials send **photo proof with a location** of road conditions, like a landslide, a damaged bridge or a delivery.

**How it works:**

1. **Take photo with location stamp.** Uses the phone or laptop camera. When you take the photo, the app **burns a stamp into the image**: address, latitude/longitude, GPS accuracy, date/time and "Recorded by: Field officer". (Or you can upload an existing photo.)
2. Choose a **category** (Road condition, Landslide or blockage, Damage, Bridge or road inspection, Cargo check, Proof of delivery) and add notes.
3. Click **Save report**. The app checks the photo's location and gives it a **location check** result:

| Condition | Result |
|---|---|
| Device GPS accurate to within 50 m | **Verified** (green) |
| Accuracy between 50 m and 100 m | **Needs review** (amber) |
| Accuracy worse than 100 m | **Rejected** (red) |
| The photo's own hidden GPS tag (EXIF) is more than 100 m from where the device says it is | **Needs review**, with the reason noted |

4. The report, including a compressed copy of the photo, is saved in a **small database inside the browser** (SQLite running in the web page, stored in the browser's IndexedDB storage). It then appears as a **dot on the map** and a row in **Saved reports** below. Clicking a row zooms the map to it.

> **Offline-friendly:** because it's saved in the browser, it works without internet. **But it is not yet synced to a central server.** The records stay on that one device and browser.

---

## 11. The SMS Alerts Page (for control rooms)

**Purpose:** get warnings to drivers by SMS. SMS can still get through where mobile data is weak.

> **This page isn't only triggered by hand.** When a simulated disruption blocks the road during a journey (section 7), the platform sends an SMS to every **verified driver** automatically, the moment that's confirmed — the alert shows up in **History** without anyone opening this page.

It has three tabs:

| Tab | What it does |
|---|---|
| **Send an alert** | Pick one driver or several, pick an alert type, fill in the location and alternative route, and send. |
| **History** | Every alert sent, with its status (queued, sent, delivered, failed). Click a row to see the full message. |
| **Drivers** | Add, edit and remove drivers: name, phone, preferred language, vehicle number and fleet. |

**Alert types include:**

- Road blocked
- Landslide
- Flood
- Severe weather
- Bridge closed
- Reroute
- Emergency
- **No-signal area ahead**: tells a driver *before* they lose signal what's ahead and where the next safe checkpoint is
- Check-in request

Each alert type has a ready-made message **template**. For example:

> *"NER-CONNECT ALERT: Active landslide reported at {location}. Corridor is hazardous. {alternateRoute}. Action: Halt immediately or divert."*

The `{location}` and `{alternateRoute}` blanks are filled in automatically.

**How messages are sent ("providers"):**

| Provider | What happens |
|---|---|
| **Test mode (not sent)** | Nothing is actually sent. It's marked "delivered" immediately. Good for demos. |
| **Twilio (real SMS)** | A **real SMS** is sent through the Twilio service (trial account; only to pre-verified numbers). This is what the automatic road-blocked alert uses. |
| **MSG91 (not set up)** | **Not built yet.** Choosing it marks the alert as **failed** with the reason, so nobody thinks it was sent. |

The **driver language** is saved with each alert, but message templates exist **in English only** for now; the page says so next to the language field.

**Where the data lives:** drivers and the alert history are saved in the **browser's local storage**. They are not in a shared database.

> **Reminder from the project rules:** If a driver has **no mobile signal at all**, no SMS can reach them. That's why the **dead-zone pre-cache advisory** exists: warn the driver *before* they enter the no-signal stretch.

---

## 12. File-by-File Map

### The Brain — `external_repo/`

| File | In plain words |
|---|---|
| [app.py](app.py) | **The front door of the brain.** Starts the web server on port 5000. `/api/evaluate` takes origin/destination, runs steps ②–⑥ and sends the main route back; `/api/route-options` finds and scores alternative routes; `/api/reroute` checks a reported disruption against a running journey (section 7); `/api/districts` lists the 31 sample districts instantly; `/api/district-route-status` runs the real road search for one district (section 8). |
| [ner_connect/routing/route_options.py](ner_connect/routing/route_options.py) | **The route comparer.** Scores any route (sectors, time, risk summary) and finds genuinely different real alternatives between two places for the Routes list. |
| [ner_connect/routing/reroute_engine.py](ner_connect/routing/reroute_engine.py) | **The rerouting engine.** Decides whether a disruption is off the route, behind the truck, a caution or a blockage; for a blockage, searches for a local bypass (widening windows plus side points), drops detours through the disruption, scores the rest and picks a hold point if nothing works. Also handles the three simulated outcomes. |
| [ner_connect/routing/route_engine.py](ner_connect/routing/route_engine.py) | **The navigator.** Turns place names into coordinates, gets the real road route from OSRM, finds junctions and bridges, and caches everything. Falls back to a clearly labelled straight line if OSRM is down. |
| [ner_connect/routing/segmenter.py](ner_connect/routing/segmenter.py) | **The road cutter.** Decides how many sectors, where to cut them (checkpost > junction > bridge), attaches milestones, and labels steep mountain climbs. |
| [ner_connect/intelligence/risk_engine.py](ner_connect/intelligence/risk_engine.py) | **The risk judge.** Loads the AI models and reference spreadsheets, gathers facts for each sector, asks the models for landslide/flood chances, and builds the sector card: colour, ETA, confidence, advice. |
| [ner_connect/intelligence/district_status.py](ner_connect/intelligence/district_status.py) | **The district checker** behind the Connectivity page (section 8). Lists the 31 sample districts from `administrative_boundaries.csv`, and for one district at a time, reuses the Routes page's "find other real roads" logic to count how many genuinely different roads reach it from Guwahati, then labels it single-road / one-backup / multiple-routes. |
| [ner_connect/intelligence/open_data_service.py](ner_connect/intelligence/open_data_service.py) | **The outside-data helper.** Gets real elevation from Open-Meteo, calculates slope, and holds the list of 8 known NER checkposts. Also has a live-weather function that **isn't used yet**. |
| [ner_connect/training/train.py](ner_connect/training/train.py) | **The teacher.** Trains the landslide and flood models from the history spreadsheets and saves them to `models/`. |
| [ner_connect/utils/geo_math.py](ner_connect/utils/geo_math.py) | **The ruler.** Distances between GPS points on the curved Earth, how much two routes overlap, the "side points" used to find other roads, and the check for dead-end detours. |
| [test_run.py](test_run.py) | **Terminal demo.** Asks questions in the terminal and prints the sector cards as text. |
| [train_models.py](train_models.py), [road_segmenter.py](road_segmenter.py), [segment_intelligence.py](segment_intelligence.py) | **Old shortcuts** kept so older commands still work. They just point to the files above. |
| [web/](web/) | **The old website.** A simpler, older dashboard served by `app.py` at `http://127.0.0.1:5000`. It only has the corridor map; the new React website replaces it. |
| [SIH26002_PROJECT_CONTEXT_README.md](SIH26002_PROJECT_CONTEXT_README.md) | **The project's rulebook**: the full vision, architecture and design rules. |

### Data Files — `external_repo/data/`

| File | What's in it | Used by the code today? |
|---|---|---|
| `terrain.csv` | Elevation, slope, terrain type and river distance at ~2,500 points | Risk engine (river distance) |
| `network_quality.csv` | Mobile signal quality (GOOD / POOR / NO_SERVICE) by location and operator | Risk engine (signal label) |
| `road_segments.csv` | Highway stretches (NH-13, NH-29…), surface, bridges, tunnels and a **hazard score** | Risk engine (upstream hazard score) |
| `landslide_history.csv` | Past days with or without landslides | Training only |
| `flood_history.csv` | Past days with or without floods | Training only |
| `weather_history.csv` | Rainfall, temperature and wind history | Not yet |
| `road_disruptions.csv` | Past closures and blockages (e.g. from ISRO landslide atlas) | Not yet |
| `field_reports.csv` | Reports from road crews and drivers | Not yet |
| `travel_time.csv` | Typical speeds, traffic and delays | Not yet |
| `administrative_boundaries.csv` | States, districts and villages of the NE | Yes: district list + centroids for the Connectivity page |
| `route_cache.json` / `geocode_cache.json` / `elevation_cache.json` | Saved routes (including alternatives), place lookups and elevations (created automatically) | Route engine, elevation lookup |

### The Website — `src/` (in the main NER-Connect folder)

| File / folder | In plain words |
|---|---|
| `src/App.tsx` | Lists the five pages and their web addresses (`/`, `/field-evidence`, `/sms`, `/connectivity`, `/deliveries`). |
| `src/components/Navbar.tsx` | The green top bar with the page tabs. |
| `src/index.css` | The **design base**: one set of named colours (page, text, lines, one green accent, three risk colours, one blue for proposed routes) and a few plain styles (panel, button, input, table, risk marker). Use these instead of one-off colours. |
| `src/pages/CorridorPage.tsx` | **Routes page.** Ties everything below together: planning, route options, map, sector table and the journey simulation. |
| `src/pages/corridor/` | Pieces of the Routes page: the planning form (`PlanForm.tsx`), route list (`RouteOptionsList.tsx`), map (`CorridorMap.tsx`), sector table (`SectorTable.tsx`), risk wording and colours (`risk.ts`), map markers (`mapIcons.ts`), the SMS wording shared by the automatic and manual alerts (`smsAlert.ts`), and the journey parts: truck playback (`useTruckPlayback.ts` — also flags `atDestination` once the simulated truck reaches the end, which is what tells the Deliveries page a trip is complete), controls (`JourneyPanel.tsx`), map overlays (`JourneyMapLayers.tsx`), the reroute card (`RerouteCard.tsx`) and the journey log (`JourneyTimeline.tsx`). |
| `src/services/corridorApi.ts` | The **messenger** that sends corridor and reroute requests to the brain and brings back the answers. |
| `src/pages/ConnectivityPage.tsx` | **Connectivity page** (section 8): district list, state filter, per-district "Check routes" / "Check all districts" buttons and the results table. |
| `src/services/connectivityApi.ts` | The **messenger** for the Connectivity page: fetches the district list and asks the brain for one district's route status. |
| `src/modules/fieldEvidence/` | **Field reports page.** Camera with location stamp (`GeoCamera.tsx`), photo upload, location check (`verificationService.ts`), in-browser database (`database/`), map and saved-reports table. |
| `src/modules/sms/` | **SMS alerts page.** Send form, history, drivers, message templates (`types/sms.ts`) and the sending logic (`services/smsStore.ts`). |
| `src/modules/deliveries/` | **Deliveries page** (section 9): the status vocabulary (`types/delivery.ts`), the browser-storage log (`services/deliveryStore.ts`), and the page itself (`DeliveriesPage.tsx`) that lists every simulated journey and its current status. Fed automatically by `CorridorPage.tsx`, not filled in by hand. |
| `vite.config.ts` | Website settings. Also runs the Twilio SMS relay and forwards corridor, reroute and district requests to the brain (for both the dev server and the `npm run preview` build). |
| `.env` / `.env.example` | Private settings such as the Twilio account keys. `.env` stays on your computer and is never uploaded to GitHub; `.env.example` shows which settings are needed. |

---

## 13. What Is Real vs. What Is Simulated

The project's golden rule is: ***"The system should not pretend to know what it cannot observe."*** So here is an honest breakdown:

| Piece of information | Real or simulated? |
|---|---|
| Road route, distance and road shape | **Real**: OpenStreetMap via OSRM |
| Place-name search | **Real**: OpenStreetMap Nominatim |
| Junctions and bridges on the route | **Real**: from OSRM's turn-by-turn steps (bridges detected by name only) |
| Elevation and slope | **Real**: Open-Meteo elevation service, saved once looked up. If unreachable, the table says **"Not available"** instead of guessing. |
| Alternative routes (Routes B and C) | **Real** OpenStreetMap roads via OSRM |
| Checkposts | **Hand-written list** of 8 known locations |
| Upstream hazard score ("ISRO/CWC feed") | **Sample data** from `road_segments.csv`. **Not** a live connection to ISRO or CWC. |
| Severe hazard scenario | **Simulated** for demos (0.88 score, 145 mm rain, applied to mountain sectors) |
| Rainfall | **Assumed** (3 mm or 15 mm). A live-weather function exists but isn't connected yet. |
| River water level | **Assumed** from the hazard score |
| Soil type | **Guessed** from slope |
| Mobile signal quality | **Sample data** from `network_quality.csv` |
| AI training data | **Sample/prepared data** in the CSV files, not an official historical record |
| Vehicle position during a journey | **Simulated**: a demo truck moving along the route, not real GPS |
| Disruptions during a journey | **Entered by hand** on the map, standing in for real reports |
| Alternative routes | **Real**: OpenStreetMap roads via OSRM, from the truck's position |
| SMS via Twilio | **Real SMS** (trial account; verified numbers only) |
| Multilingual alerts | Drivers can be tagged with 8 languages, but **message templates exist in English only** so far |
| District road counts (Connectivity page) | **Real**: OpenStreetMap roads via OSRM, same search as Routes B/C. District list and centroids are **sample data** (`administrative_boundaries.csv`), not an official boundary dataset. |
| Delivery status (Deliveries page) | **Simulated**: it mirrors the journey simulation's status changes, not a real fleet-tracking feed |

---

## 14. Known Gaps and Issues

These are worth knowing before a demo or before building further:

1. **Journeys are simulated.** Rerouting works (section 7), but the truck is a demo icon rather than real vehicle GPS, and disruptions are added by hand rather than arriving from weather feeds or field reports.
2. **Field evidence, drivers, the SMS history and the delivery log live only in one browser.** Nothing is synced to a central server yet.
3. **Four data files aren't used yet**: weather, disruptions, field reports and travel time (see the data table in section 12).
4. **Rainfall is assumed, not measured.** A live-weather helper exists but isn't connected to the risk engine yet.
5. **Alert messages exist in English only**, even though drivers can be tagged with 8 languages.
6. **MSG91 SMS isn't built.** It needs an MSG91 account key and a government-approved (DLT) message template.
7. **The old Twilio auth token is still in the GitHub history.** The keys have moved to the private `.env` file, but the old token should be **replaced in the Twilio console** to be safe.
8. **The free OSRM and Nominatim services are shared and rate-limited.** Fine for demos; a real deployment would need its own routing server.

**Already fixed** (listed here so old notes make sense):
- `segment_intelligence.py` crashed when imported. Fixed.
- The severe scenario only affected sector 5 and later. It now affects mountain sectors on any route.
- MSG91 alerts sat at "queued" forever. They're now clearly marked as failed.
- Twilio keys were written in the code. They're now in `.env`.
- Live-camera photos were lost after a reload. The image itself is now saved.
- Saving evidence could fail once the database outgrew about 125 KB (roughly one photo), or when browser storage filled up. The database is now kept in larger IndexedDB storage without that limit.

---

## 15. What Comes Next (Roadmap)

Following the build order in the project rulebook:

| Phase | Goal | Status |
|---|---|---|
| 1 | Route from A to B, cut into sectors | Done |
| 2 | Risk level + reason + confidence per sector | Done (inputs partly simulated) |
| 3 | Vehicle GPS: know which sector a truck is in | Simulated truck; real GPS feed next |
| 4 | New event (e.g. rain warning) → update only the affected sectors | Manual disruptions checked against the journey; automatic feeds not yet |
| 5 | Rerouting from the truck's current position | Done (operator accepts or keeps the route) |
| 6 | Communication: app, SMS, fleet operator, offline cache | SMS done, including automatic alerts on a blockage; pre-cache is only an advisory |
| 7 | Field reports → offline storage → sync → risk update | Capture + offline storage done; sync and risk link not yet |
| 8 | Real government/external data feeds | ⏳ Only after the above are stable |

---

## 16. Mini Glossary

| Term | Meaning |
|---|---|
| **Corridor** | A long road trip between two places, e.g. Guwahati → Gangtok. |
| **Sector / Segment** | One piece of the corridor, at least 50 km long. |
| **Geocoding** | Turning a place name into map coordinates. |
| **OSRM** | A free routing service that finds the driving route on OpenStreetMap roads. |
| **Nominatim** | OpenStreetMap's free place-name search. |
| **Polyline** | The list of GPS points that traces the road on the map. |
| **Upstream hazard score** | A 0–1 number standing in for an official agency warning. Higher means more dangerous. |
| **Cache** | A saved copy of an answer, so the same question gets the same answer instantly without using the internet. |
| **Fallback** | The backup plan when a service is unavailable, e.g. a straight line instead of a road. |
| **Dead zone** | A stretch of road with no mobile signal. |
| **Pre-cache** | Downloading information *before* entering a dead zone. |
| **Hub** | The reference city (Guwahati) that every district's road count, on the Connectivity page, is measured from. |
| **EXIF** | Hidden information stored inside a photo file, sometimes including where it was taken. |
| **API** | A "door" one program uses to ask another program for something, e.g. `/api/evaluate`. |

---

*If you ever feel lost while working on the project, come back to section 5 (how a request flows) and section 12 (which file does what).*
