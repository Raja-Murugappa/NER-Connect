# NER-Connect — Flow Understanding (From "Dimapur → Imphal" to a Coloured Map)

This file answers one question: **"What exactly happens, step by step, technically, between someone typing a start and end point and seeing a risk-coloured map?"**

It's written to be read top to bottom in one sitting. For *why* a particular algorithm was picked, see `BASIC_ALGORITHM_UNDERSTANDING.md`. For the full feature-by-feature tour, see `UNDERSTANDING.md`.

---

## 1. The Flow Chart (the whole journey, at a glance)

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  YOU type: From "Dimapur"  →  To "Imphal"  → click "Find routes"          │
└───────────────────────────────────────┬─────────────────────────────────┘
                                          │  WEBSITE (React) sends one request
                                          ▼
                          POST /api/evaluate  { origin, destination }
                                          │
                                          ▼  BRAIN (Python/Flask) takes over
┌───────────────────────────────────────────────────────────────────────────┐
│ STEP 1 — GEOCODE                                                          │
│  "Dimapur" (text)  →  25.90°N, 93.72°E (a GPS point)                      │
│  "Imphal"  (text)  →  24.82°N, 93.94°E (a GPS point)                      │
│  Tech: Nominatim (OpenStreetMap place search), India-only, cached.        │
└───────────────────────────────────────┬─────────────────────────────────┘
                                          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ STEP 2 — GET THE REAL ROAD                                                │
│  2 GPS points  →  one real driving route: thousands of GPS points that    │
│  trace the actual highway, + distance, + turn-by-turn steps.              │
│  Tech: OSRM (routing service). Internally uses Contraction Hierarchies    │
│  (a fast version of Dijkstra's shortest-path algorithm) — not our code.   │
│  From the turn-by-turn steps, our code also pulls out: junctions (forks/  │
│  merges) and bridges (name contains "bridge"/"setu"/"flyover").           │
└───────────────────────────────────────┬─────────────────────────────────┘
                                          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ STEP 3 — CUT INTO SECTORS  ◄── "segments are generated HERE"              │
│  One long polyline (208 km)  →  a handful of sectors (e.g. 3), each       │
│  ≥ 50 km, each ending at a real landmark where possible.                  │
│  Tech: a custom rule-based algorithm (NOT machine learning):              │
│    a) Maths decides roughly where cuts should go (~every 80 km).         │
│    b) Each rough cut point is "snapped" to the nearest real landmark      │
│       inside a search window, in priority order:                         │
│         Checkpost  >  Major junction  >  Bridge  >  (fallback: no        │
│         landmark close enough, cut at the plain distance mark)           │
│    c) Hard rule: every sector ≥ 50 km, last sector ≥ 35 km.               │
│  Also here: elevation of each sector's start/end is looked up (Open-Meteo │
│  elevation service, cached) and slope is calculated from it.             │
└───────────────────────────────────────┬─────────────────────────────────┘
                                          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ STEP 4 — SCORE EACH SECTOR (the "AI" step)                                │
│  For every sector's midpoint, gather 6 facts:                             │
│    elevation & slope (from step 3), distance to nearest river,            │
│    mobile signal, "upstream hazard score", rainfall (assumed), soil type  │
│    (guessed from slope).                                                  │
│  Tech, finding those facts: a BallTree nearest-neighbour search (scikit-  │
│  learn) finds the closest row in terrain.csv / network_quality.csv /      │
│  road_segments.csv to the sector's midpoint — instantly, out of           │
│  thousands of rows.                                                       │
│  Tech, turning facts into risk: those facts go into TWO trained           │
│  Gradient Boosting models (scikit-learn GradientBoostingClassifier,       │
│  100 small decision trees each) —                                        │
│      Model 1 → landslide probability (e.g. 23%)                          │
│      Model 2 → flood probability      (e.g. 8%)                          │
│  The WORSE of the two decides the sector's colour:                       │
│      ≥ 50% → red (High)   |   20–49% → amber (Medium)   |   < 20% → green│
│  Plain maths (not ML) then works out: travel speed (from slope), ETA,     │
│  and a confidence % — simple if/else rules, on purpose, so they're        │
│  always explainable.                                                     │
└───────────────────────────────────────┬─────────────────────────────────┘
                                          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ STEP 5 — ADD UP THE TOTALS                                                │
│  All sector cards  →  one route summary: total distance, total time,      │
│  a risk summary ("High risk on 1 of 3 sectors").                          │
└───────────────────────────────────────┬─────────────────────────────────┘
                                          ▼
                     WEBSITE shows Route A immediately, using this answer
                                          │
                                          ▼  a SECOND request fires in the background
                          POST /api/route-options  { origin, destination }
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ STEP 6 — FIND OTHER REAL ROADS (Route B / Route C)                        │
│  Ask OSRM twice more: (a) for its own built-in alternatives, and (b) for  │
│  routes forced through "side points" left/right of the main road (this    │
│  tricks the router into using other roads — OSRM has no "avoid this       │
│  area" option).                                                          │
│  Tech: a greedy filter keeps a candidate road only if —                   │
│    • it overlaps the main route by less than 90% (not a near-duplicate)   │
│    • it's at least 30% geometrically different from the main route        │
│    • it isn't a dead-end loop (checked with the same BallTree technique)  │
│    • it isn't more than 60% longer than the main route                    │
│  Each surviving road then goes through STEP 3 and STEP 4 again, on its    │
│  own polyline, to get its own sectors and risk.                          │
└───────────────────────────────────────┬─────────────────────────────────┘
                                          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ STEP 7 — DRAW THE MAP                                                     │
│  Selected route: coloured by sector risk (green/amber/red).               │
│  Other routes: grey dashed lines, click to switch.                        │
│  Markers: start (dark circle), destination (dark square), junction        │
│  (hollow circle), bridge (hollow square).                                 │
│  Table: one row per sector — length, time, elevation, risk.               │
└───────────────────────────────────────────────────────────────────────────┘
```

That's the whole trip: **2 typed names in → 1–3 real, risk-scored road routes out**, in roughly 5–15 seconds the first time (instant afterwards, because every step caches its answer).

---

## 2. "What Comes In, What It Does, What Comes Out" — Step by Step Table

This is the same flow as above, laid out as a simple table — useful for answering "at this exact point in the process, what data do we have, and what turns it into what?"

| Step | Input (what comes in) | What it does | What comes out |
|---|---|---|---|
| **1. Geocode** | Two place names (text), e.g. `"Dimapur"`, `"Imphal"` | Looks the name up with OpenStreetMap's Nominatim search, restricted to India. Saves the answer so the same name is never looked up twice. | Two GPS points (lat, lon) |
| **2. Get the road** | Two GPS points | Asks OSRM for the real driving route between them; scans the turn-by-turn directions for junctions and bridges. Falls back to a clearly-labelled straight line if OSRM can't be reached. | One polyline (thousands of GPS points), total distance, junction list, bridge list |
| **3. Segment** | One polyline + distance + junctions + bridges | Works out how many sectors are needed (2–7, roughly one per 80 km), then snaps each cut point to the nearest usable landmark (checkpost > junction > bridge) without breaking the 50 km minimum rule. Looks up elevation for each sector's ends and calculates slope. | A list of sectors, each with its own short polyline, distance, elevation, slope, and "why it was cut here" |
| **4. Score** | One sector (midpoint, elevation, slope) | Finds the nearest matching row in 3 reference spreadsheets (via BallTree). Builds the 5–6 numbers the models need. Runs the landslide model and the flood model. Applies fixed rules for colour, speed, ETA, confidence. | One "sector card": risk %, colour, ETA, confidence, advice |
| **5. Total up** | All sector cards for one route | Sums travel time, counts sectors per risk level | One route summary: distance, ETA, "High risk on 1 of 3 sectors" |
| **6. Find alternatives** | Origin, destination, the main route's polyline | Requests extra candidate roads from OSRM, filters out duplicates/dead-ends/too-different-in-length, re-runs steps 3–5 on each survivor | 0–2 extra full routes (Route B, Route C), each already sectored and scored |
| **7. Display** | 1–3 scored routes | Draws the selected route coloured by risk, other routes as grey dashed lines, places markers, fills the sector table | The map and table you see on screen |

---

## 3. When Exactly Are "Segments" Generated?

This gets asked a lot, so it gets its own short answer:

- Segmentation (Step 3) happens **once OSRM has returned a real road**, and **before** any risk scoring happens — you cannot score a sector's risk until the sector itself exists.
- It happens **separately for every route shown**: the main route (Route A) is segmented once; each alternative (Route B, Route C) is segmented again on its *own* polyline, because a different road has different landmarks, different elevation, different sector count.
- It also happens **again, on the fly**, in two other situations later in the app's life:
  - **During a live journey**, if a road gets blocked and a detour is found (see section 4 below), the detour road is segmented the same way, from scratch.
  - **On the Connectivity page**, segmentation itself isn't needed (that page only counts how many distinct roads exist to a district), but it reuses the exact same "is this a genuinely different road" filter from Step 6.
- Segmenting is **never done on a fake/straight-line route** in a way that pretends to be real — a fallback straight line is flagged and not treated as a normal road for sector purposes.

---

## 4. What Happens After That: the Live Journey (a shorter second flow)

The Routes-page flow above answers *"what's the risk along this trip, right now, before I leave?"*. There's a second, related flow for *after* the truck (simulated) sets off — worth knowing since it reuses the same building blocks:

```text
Truck (blue dot) moves along the selected route  (a demo, not real GPS)
        │
        ▼
Operator reports a disruption on the map (type, effect, area)
        │
        ▼
Is it near the route, and ahead of the truck?
   ├─ No / already passed  →  "No impact" / "No action needed" — truck keeps going
   ├─ Ahead, slow-down only →  amber caution — truck keeps going
   └─ Ahead and BLOCKS the road
              │
              ▼
      Search for a bypass: leave the road before the blockage, rejoin after
      (tries 25 km, then 60 km, then 120 km windows; also forces OSRM through
       side points left/right of the blockage — same trick as Step 6 above)
              │
              ▼
      Filter candidates with the SAME greedy overlap/dead-end/length rules
      as Route B/C selection (Step 6) — reused, not reinvented
              │
              ▼
      Each surviving detour is segmented and scored (Steps 3–4, again)
              │
              ▼
      Options shown, safest-first: "Detour 1 (recommended)", "Detour 2"...
      SMS sent automatically to verified drivers the moment a blockage is confirmed
              │
              ▼
      Operator decides: take a detour / keep the route / hold — never automatic
```

The technical toolkit here is identical to the planning flow — the same routing service, the same segmentation algorithm, the same risk models, the same route-distinctness filter — just triggered by a reported disruption instead of an initial search. See `UNDERSTANDING.md` section 7 for the full feature description, and `BASIC_ALGORITHM_UNDERSTANDING.md` for why each technique was chosen.

---

## 5. Quick Glossary for This Flow

| Term | Plain meaning |
|---|---|
| **Polyline** | The list of GPS points that draws the road shape on the map. |
| **Geocode** | Turn a place name into a GPS point. |
| **Sector / Segment** | One piece of a route, cut at a sensible landmark, at least 50 km long. |
| **BallTree lookup** | "Which row of reference data is physically closest to this point?" — answered fast using a spatial index instead of checking every row. |
| **Gradient Boosting model** | The trained ML model (100 small decision trees) that turns sector facts into a landslide/flood probability. |
| **Greedy filter** | The rule "keep a candidate only if it passes every check, in order, stop once we have enough" — used to pick Route B/C and to filter detours. |
| **Cache** | A saved answer, so the same geocode/route/elevation lookup is never repeated. |

---

*Read this file when you need the end-to-end picture with the technical detail attached. For "why this algorithm and not another", go to `BASIC_ALGORITHM_UNDERSTANDING.md`. For the full page-by-page feature tour, go to `UNDERSTANDING.md`.*
