# NER-Connect — Basic Algorithm Understanding

This is a **cram sheet for panel questions** like *"What algorithm are you using here?"* and *"Why this one and not something else?"*. It does not explain the code line by line — it names each algorithm, says what job it does, and gives a simple, defensible reason for choosing it.

> **Golden rule to repeat in the panel:** NER-Connect uses **machine learning only where a judgment call is genuinely needed** (will this slope + rain combination cause a landslide?). Everything else — finding the nearest reference point, cutting a road into sectors, deciding if two routes are "different enough" — is **plain, explainable math and rules**. That's a deliberate choice: a logistics operator needs to trust and audit the system, not guess what a black box is doing.

---

## 1. The One-Page Cheat Sheet

| # | Where it's used | Algorithm / technique | One line — what it does |
|---|---|---|---|
| 1 | Every distance calculation (route length, sector cuts, "how far is this point from that road") | **Haversine formula** | Straight-line distance between two GPS points on a sphere (the Earth), not a flat map. |
| 2 | "Which reference data point is closest to this sector?" (terrain, mobile signal, hazard score); "is this point close to the route?" (route comparison, dead-end detection) | **BallTree nearest-neighbour search** (scikit-learn, haversine metric) | A pre-built spatial index that finds the *closest* point out of thousands almost instantly, instead of checking every single one. |
| 3 | Predicting landslide chance and flood chance for each road sector | **Gradient Boosting Classifier** (scikit-learn `GradientBoostingClassifier`) | A machine-learning model trained on ~2,600 past days of data that outputs a probability (0–100%) from a handful of numbers (rain, slope, elevation, hazard score, etc.). Two separate models: one for landslide, one for flood. |
| 4 | Turning "soil type" (a word) into a number the model can use | **Label Encoding** (scikit-learn `LabelEncoder`) | A lookup table: "Schist Shale" → 0, "Loose Phyllite" → 1, "Sandy Clay" → 2. Models only understand numbers. |
| 5 | Cutting a 200 km road into sectors at sensible landmarks | **Priority-based greedy snapping** (custom rule-based algorithm) | Decides roughly where cuts should go by simple division, then "snaps" each cut to the nearest real landmark (checkpost first, then junction, then bridge) inside an allowed window, with a strict 50 km minimum sector length. |
| 6 | Picking Route B and Route C, and (new) counting how many real roads reach a district | **Greedy filtering by geometric overlap** (custom rule-based algorithm, uses the BallTree distance from #2) | Out of several candidate roads, keeps a new one only if it shares less than 90% of its path with roads already picked, differs from the main route by at least 30%, isn't a dead-end loop, and isn't absurdly longer. |
| 7 | Finding the actual road / turn-by-turn path between two GPS points (inside the free OSRM service we call, not code we wrote) | **Contraction Hierarchies** (a fast variant of Dijkstra's shortest-path algorithm) | Pre-processes the whole road network once so that "shortest/fastest path" queries between any two points come back in milliseconds instead of minutes. |
| 8 | Deciding travel speed, confidence %, and risk colour per sector | **Deterministic rule-based formulas** (not ML) | Plain if/else thresholds — e.g. "if worst risk ≥ 50%, colour = red" — chosen so the reasoning is always inspectable, not learned. |

---

## 2. Distance & Nearest-Point Math

### Haversine formula
**What it is:** a well-known formula (17th century, still standard today) for the distance between two points on a sphere, given their latitude and longitude.

**What it does here:** every "how many km apart" question in the project uses it — route length, sector cut points, "is this checkpost within 5 km of the road", "is this disruption within 1/2/5 km of the truck".

**Why this and not something simpler:** a flat-map (Pythagoras) distance is wrong by a noticeable margin over tens of kilometres, and gets worse the further north or south you go — the Earth is curved, and the North East sits far enough from the equator that the error would matter for a 50 km minimum-sector rule. Haversine treats the Earth as a sphere, which is accurate to well under 1% for this use case (an ellipsoid model like Vincenty's would be marginally more accurate but is overkill — GPS and road data already carry more error than that).

### BallTree nearest-neighbour search (scikit-learn)
**What it is:** a *spatial index* — a data structure built once from a set of points, which can then answer "what's the closest point to X?" very quickly, instead of measuring the distance to every single point one by one.

**What it does here, specifically:**
- **Risk scoring:** for every road sector, three BallTrees (one each for `terrain.csv`, `network_quality.csv`, `road_segments.csv`) find the nearest row of reference data to that sector's midpoint — its elevation baseline, mobile signal quality, and upstream hazard score.
- **Route comparison / dead-end detection / district connectivity:** a BallTree over one route's GPS points answers "how much of route A also lies on route B?" and "does this route double back on itself?" by checking, for thousands of points, whether the nearest point on the other line is within ~100 m.
- Both trees use the **haversine metric** (distance on a sphere, not a flat grid), so the "nearest" answer respects real-world geography.

**Why this and not a simple loop ("check every point")):** a brute-force check compares every point against every other point — with a 200 km route sampled every few metres, that's tens of thousands of comparisons, repeated for every sector and every alternative route. A BallTree organises the points into a tree of nested regions first, so a "nearest point" query only has to look at a small branch of the tree, not the whole set. It's the standard, well-tested choice in Python's scientific stack (scikit-learn) for exactly this kind of geographic nearest-neighbour problem — no need to write or maintain our own spatial-indexing code.

**Alternative considered and rejected:** a `KDTree` is the other common option, but it assumes flat, grid-like coordinates; `BallTree` supports the haversine (great-circle) distance natively, which is the correct metric for latitude/longitude.

---

## 3. The Machine Learning Model: Gradient Boosting

This is the part most likely to get a direct "what algorithm, and why" question, so it gets the most detail.

**What it's called:** `GradientBoostingClassifier` from scikit-learn — two separate instances, one trained to predict **landslide** probability, one trained to predict **flood** probability.

**What "Gradient Boosting" means, in plain words:** instead of one big complicated model, it builds **many small decision trees, one after another** (100 of them, here). Each new tree's whole job is to correct the mistakes the previous trees made. Combined, the 100 small trees "vote" together, weighted by how much each helped, to produce one final probability. Think of it as **100 short, simple yes/no flowcharts (e.g. "Is rainfall over 80mm? Is slope over 25%?"), where each new flowchart focuses on the cases the earlier ones got wrong.**

**The exact settings used, and why:**
- `n_estimators=100` — 100 trees. Enough to capture the patterns in ~2,600 rows of training data without taking long to train or predict; more trees gives diminishing returns and risks overfitting the sample data we have.
- `max_depth=4` — each individual tree is shallow (at most 4 yes/no questions deep). Shallow trees keep each tree simple and interpretable, and combining many *simple* trees generalises better than a few *complex* ones — the classic bias/variance trade-off behind boosting.
- `random_state=42` — makes training reproducible: retraining on the same data always gives the same model, which matters for a demo and for debugging.

**What goes in, what comes out:**
- **Landslide model inputs:** upstream hazard score, rainfall (mm), elevation (m), slope (%), soil type (encoded as a number).
- **Flood model inputs:** upstream hazard score, rainfall (mm), river water level (m), distance to nearest river (km), elevation (m).
- **Output:** a probability between 0 and 1 (shown as a percentage) — not a hard yes/no. The system then applies its own thresholds (≥50% = High, 20–49% = Medium, <20% = Low) so the *cutoffs* stay visible and easy to justify, rather than being buried inside the model.

**Why Gradient Boosting and not something else — have this answer ready:**
- **vs. a single Decision Tree:** one tree memorises noise in a small dataset (overfits) and is unstable — change one row of training data and the tree's shape can change a lot. Averaging 100 small trees, each fixing the last one's errors, is far more stable and typically more accurate.
- **vs. Logistic Regression:** logistic regression assumes each factor affects the outcome in a straight, additive line (more rain = proportionally more risk, always). Real hazard behaviour is not linear — e.g. rain matters far more once slope crosses a threshold *and* the hazard score is already high. Tree-based models like Gradient Boosting naturally capture those "only matters in combination" interactions without us having to hand-engineer them.
- **vs. a Neural Network / Deep Learning:** deep learning needs a lot of data (tens of thousands+ of examples) to avoid overfitting and to beat simpler models; we have ~2,600 rows per hazard. On tabular data of this size, Gradient Boosting is the well-established, better-performing default in the industry (this is the same family of model that wins most Kaggle competitions on structured/tabular data), and it's far easier to inspect (see "feature importance" below) and explain to a non-technical panel.
- **vs. Random Forest** (another popular tree-ensemble): both are strong choices here. Random Forest builds many trees *independently* and averages them; Gradient Boosting builds trees *sequentially*, each one correcting the last, which usually gets higher accuracy from the same number of trees on a dataset this size — at the cost of being slightly more sensitive to bad hyperparameters, which is why `max_depth` is kept shallow.

**Feature importance — a good thing to mention if asked "how do you know the model isn't guessing":** `train.py` prints, after training, exactly how much each input contributed to the model's decisions (e.g. "upstream hazard score: 45%, rainfall: 25%, slope: 15%..."). This is a built-in transparency feature of tree-based models — you can *see* what the model is paying attention to, unlike a neural network.

**Where the trained models live:** training happens once (`python train_models.py`), and the result is saved to three small files (`models/landslide_model.joblib`, `models/flood_model.joblib`, `models/soil_encoder.joblib`) using `joblib`. The live app just loads these files — it does not retrain on every request.

### Label Encoding
**What it is:** the simplest possible way to turn a category (a word) into a number: assign each distinct word an integer.

**What it does here:** soil type is guessed from slope ("Schist Shale", "Loose Phyllite", "Sandy Clay") and fed to the landslide model as a number, because scikit-learn models can only do arithmetic on numbers, not read text.

**Why this and not something fancier (like one-hot encoding):** there are only 3 soil categories and tree-based models (like Gradient Boosting) split on a single numeric threshold at a time, so they handle a single encoded column just as well as several separate "is it this category / yes-no" columns — one-hot encoding would add unnecessary columns for no accuracy benefit here.

---

## 4. Rule-Based Logic (Deliberately *Not* Machine Learning)

These parts look like they *could* be ML, but are plain rules on purpose — worth stating clearly if a panel member asks "is this AI too?": **no, and that's intentional**, because these are decisions that need to be predictable and auditable, not learned.

### Priority-based greedy snapping (road segmentation)
**What it does:** decides where to cut a long road into sectors.
1. First, simple division works out roughly where the cuts *should* be (e.g. every ~80 km).
2. Then, for each rough cut point, it looks in a window around that point for the best real landmark to snap to, checked in strict priority order: a **checkpost** beats a **major junction**, which beats a **bridge**.
3. A hard rule (never relaxed) enforces every sector is **at least 50 km**, and the final sector is **at least 35 km**.
4. If nothing suitable is found in the window, it falls back to cutting at the plain distance mark.

**Why "greedy" and rule-based, not a model:** this is a constraint-satisfaction problem with a small, well-understood set of rules (priority order + minimum length) — writing it as explicit `if/else` logic means anyone can predict exactly where a cut will land and why, which matters when an operator asks "why did you split the road here?". There's no ambiguous judgment call to learn from data; a trained model would add uncertainty and reduce explainability for zero benefit.

### Greedy overlap filtering (choosing Route B / Route C, and district road-counting)
**What it does:** after gathering several candidate real roads from the routing service, it walks through them (shortest first) and **keeps a candidate only if it passes four checks**: not more than 60% longer than the main route, at least 30% geometrically different from the main route, not a dead-end loop (detected via the BallTree "does this route revisit itself" check), and not a near-duplicate (≥90% overlap) of a route already kept. This exact same filter, reused unchanged, is what counts "how many genuinely different roads reach this district" on the Connectivity page.

**Why this and not, say, clustering the routes with an ML algorithm:** "different enough to be a real alternative" is a concrete, measurable geometric property (what fraction of the path overlaps), not a pattern that needs to be learned from examples — a fixed, well-reasoned threshold is more transparent and easier to tune live than training a model for it.

### Deterministic formulas (speed, confidence, colour)
**What they do:** e.g. sector speed drops from 65 km/h to 45 km/h to 30 km/h as slope increases past fixed thresholds; confidence starts at 98% and decreases as risk increases (never below 68%); risk colour is red at ≥50%, amber at 20–49%, green below that.

**Why fixed formulas and not a learned model:** these are policy decisions ("how cautious should we be, and how should we *communicate* that caution"), not predictions about the physical world — they belong to the people running the system, not to a model trained on historical data, and they need to be trivially explainable in one sentence during a demo.

---

## 5. The Routing Service Itself (context, not our code)

**What it's called:** **OSRM** (Open Source Routing Machine), a free public service we call over the internet — we do not implement road-finding ourselves.

**What algorithm it runs internally:** **Contraction Hierarchies**, a well-known speed-up technique built on top of **Dijkstra's shortest-path algorithm** (the classic algorithm for "shortest path between two points in a network"). It works by pre-processing the entire road network once, "contracting" less important roads into shortcuts, so that a shortest-path query between any two points later comes back in milliseconds instead of searching the whole map from scratch each time.

**Why mention this in the panel:** it shows we understand *what's actually finding the roads* (a real, industry-standard routing engine) versus what our own code adds on top of it (segmentation, risk scoring, and the greedy filtering above, which OSRM knows nothing about). We deliberately did not try to reimplement road-network routing ourselves — that would be reinventing a well-solved, infrastructure-heavy problem instead of focusing effort on the actual project goal: turning a route into an operational risk picture.

---

## 6. Likely Panel Questions, With Ready Answers

**Q: "What algorithm are you using for risk prediction?"**
A: "Gradient Boosting — specifically scikit-learn's `GradientBoostingClassifier`, 100 shallow decision trees trained one after another, each correcting the errors of the ones before it. We run two of them: one for landslide risk, one for flood risk."

**Q: "Why Gradient Boosting and not deep learning / a neural network?"**
A: "Our training data is a few thousand rows of structured, tabular data — rainfall, slope, elevation, and so on. Tree-based models like Gradient Boosting are the established best performer on tabular data of this size, they train in seconds, and — importantly — they're explainable: we can print exactly which input mattered most to each prediction. A neural network would need far more data to avoid overfitting and would be a black box we couldn't justify to an operator."

**Q: "How do you find the nearest reference data for a road sector?"**
A: "A BallTree — a spatial search structure from scikit-learn, using the haversine (great-circle) distance so it respects real GPS geography. It answers 'which row of this dataset is physically closest to this point' in effectively constant time, rather than comparing against every row."

**Q: "How do you decide where to cut a route into sectors?"**
A: "That's deliberately not machine learning — it's a rule-based, priority-ordered snapping algorithm. We calculate rough even cut points, then snap each one to the nearest real landmark within a window, preferring checkposts, then junctions, then bridges, while enforcing a strict minimum sector length. It's a rules engine, not a prediction, because the logic needs to be fully explainable."

**Q: "How do you know two routes are actually different roads, not the same road twice?"**
A: "We measure geometric overlap: what fraction of one route's GPS points lie within about 100 metres of the other route, found efficiently with the same BallTree technique. A route is only kept as a genuine alternative if it's at least 30% different from the main route and shares less than 90% of its path with any alternative we've already picked."

**Q: "Is any of this real AI, or is it all hardcoded?"**
A: "Both, on purpose. The two hazard-probability predictions are genuine trained machine-learning models (Gradient Boosting). Everything around them — segmentation, route comparison, speed/confidence/colour — is deliberate rule-based logic, because those are policy and geometry decisions that need to stay fully explainable, not things that benefit from being learned from data."

**Q: "What would you change with more time/data?"**
A: "Feed the models real live weather and official hazard-agency data instead of the sample CSVs (the architecture already has a clean slot for that — the 'upstream hazard score' — see UNDERSTANDING.md section 13), and retrain with more historical rows as they become available. The algorithm choice itself would likely stay the same; Gradient Boosting scales well as more data arrives."

---

*Pair this with `UNDERSTANDING.md` for the plain-language walkthrough of what the system does; this file is specifically for defending *which* algorithm does each job and why.*
