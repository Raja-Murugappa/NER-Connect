# 🗺️ NER-Connect: Beginner's Guide & Project Overview

Welcome to **NER-Connect**! 

If you are new to the codebase or new to AI/ML, **don't worry**. You do not need to understand complex math or algorithms to understand how this platform works.

This guide explains **what each file does**, **how they talk to each other**, and **the big picture** using simple, everyday language.

---

## 1. The Big Picture (In 1 Minute)

### The Real-World Problem:
In the North Eastern Region (NER) of India, roads go through steep mountains and heavy monsoon rain. 
- A sudden landslide or flood can block a highway.
- Mobile networks frequently cut out (dead zones).
- Normal map apps (like Google Maps) might show a road, but they don't tell a truck driver carrying essential medicines: *"Watch out! This section has an 80% chance of a landslide in 2 hours because of heavy rainfall on a steep hill."*

### What Our Software Does:
1. Takes a long road trip (e.g., Guwahati to Gangtok).
2. **Cuts the road into smaller pieces** (called "segments").
3. For each segment, it checks:
   - How steep is the hill? (Terrain)
   - How much is it raining right now? (Weather)
   - Does mobile phone service work here? (Network)
4. It feeds this information into a simple **AI Safety Checker** that predicts:
   - Is there a Landslide risk? (Low / Moderate / High)
   - Is there a Flood risk? (Low / Moderate / High)
5. It prints an easy-to-read **Risk Card** with colors (🟢 Green, 🟡 Yellow, 🔴 Red) and safety advice.

---

## 2. The 4-Step Process: How Code Flows

Think of our system like an assembly line:

```text
[Start & End GPS Points]
          │
          ▼
   1. ROAD CUTTER (road_segmenter.py)
   "Slice the 500 km trip into 50 km bite-sized segments"
          │
          ▼
   2. DATA MATCHER (segment_intelligence.py)
   "Look at each piece: What is the slope? Is it raining? Is there cell service?"
          │
          ▼
   3. AI PREDICTOR (models/ folder, trained by train_models.py)
   "Check past memory: High rain + steep slope = Danger!"
          │
          ▼
   4. FINAL SAFETY CARD (test_run.py / User Interface)
   "Segment 2: 🔴 High Landslide Risk! ETA delayed by 40 mins."
```

---

## 3. What Does Each File Do?

Here is every file in your folder and its exact responsibility:

### 🐍 Python Scripts (The Logic)

| File | What is it? | Real-World Analogy |
| :--- | :--- | :--- |
| [road_segmenter.py](file:///c:/NER-Connect/road_segmenter.py) | **Road Slicer** | Like cutting a long cucumber into smaller 50 km slices. A landslide doesn't block the whole state; it only blocks one specific slice! |
| [train_models.py](file:///c:/NER-Connect/train_models.py) | **AI Teacher** | A teacher showing a student past history books (*"Look, whenever rain was over 100mm on a steep hill, a landslide happened"*). It teaches the AI and saves its brain into files. |
| [segment_intelligence.py](file:///c:/NER-Connect/segment_intelligence.py) | **The Core Brain** | The detective. For any road slice, it finds the nearest weather station, checks the hill slope, asks the AI models for risk probabilities, and builds the safety report. |
| [test_run.py](file:///c:/NER-Connect/test_run.py) | **Interactive Demo** | A playground script you can run in your terminal. You can pick a corridor, simulate a storm, and see the safety cards printed on screen. |

---

### 🧠 The Models Folder (`models/`)

These files are the saved "memories" created by [train_models.py](file:///c:/NER-Connect/train_models.py). Think of them as pre-saved cheat sheets so we don't have to re-train the AI every time:

| File | Simple Explanation |
| :--- | :--- |
| `models/landslide_model.joblib` | The saved AI brain that calculates: *"Given rainfall + hill slope + elevation, what is the % chance of rocks/mud falling?"* |
| `models/flood_model.joblib` | The saved AI brain that calculates: *"Given rainfall + river distance + river water level, will the road be underwater?"* |
| `models/soil_encoder.joblib` | Computers only understand numbers, not words. This converts soil names like `"Sandy_Clay"` or `"Schist_Shale"` into simple numbers like `0` or `1`. |

---

### 📊 The Data Files (`.csv`)

These are tables of information (like Excel spreadsheets) about the North East:

| Category | CSV File | What Information It Contains |
| :--- | :--- | :--- |
| **Geography** | [terrain.csv](file:///c:/NER-Connect/terrain.csv) | Hill elevation (meters), steepness (% slope), and how close the nearest river is. |
| **Weather** | [weather_history.csv](file:///c:/NER-Connect/weather_history.csv) | Daily rainfall amount (mm) and weather conditions (Clear, Heavy Rain, etc.). |
| **Mobile Signal** | [network_quality.csv](file:///c:/NER-Connect/network_quality.csv) | Tells us if a location has `"GOOD"`, `"POOR"`, or `"NO_SERVICE"` connectivity. |
| **Road Network** | [road_segments.csv](file:///c:/NER-Connect/road_segments.csv) | Official highway details (NH-13, NH-27, etc.), whether there are bridges, tunnels, and road surface. |
| **Past Disasters** | [landslide_history.csv](file:///c:/NER-Connect/landslide_history.csv) | Past events used to train the Landslide AI. |
| **Past Disasters** | [flood_history.csv](file:///c:/NER-Connect/flood_history.csv) | Past events used to train the Flood AI. |
| **Live Incidents** | [road_disruptions.csv](file:///c:/NER-Connect/road_disruptions.csv) | Known road closures and blockages reported by agencies (e.g., ISRO Landslide Atlas). |
| **Field Updates** | [field_reports.csv](file:///c:/NER-Connect/field_reports.csv) | Reports submitted by road workers, police, or truck drivers on the ground. |
| **Speed & Timing**| [travel_time.csv](file:///c:/NER-Connect/travel_time.csv) | How long trips normally take and typical delay times. |
| **Boundaries** | [administrative_boundaries.csv](file:///c:/NER-Connect/administrative_boundaries.csv) | List of states and districts in the North East. |

---

## 4. How the AI Part Works (Without Math or Jargon)

People often think AI is magic, but in this project it is very simple:

1. **Step 1: Looking at the Past**  
   We have a spreadsheet ([landslide_history.csv](file:///c:/NER-Connect/landslide_history.csv)) with 1,000 past days:
   - Day 1: Rain = 10mm, Slope = 5% ➔ **No Landslide (0)**
   - Day 2: Rain = 180mm, Slope = 40% ➔ **Landslide Happened (1)**

2. **Step 2: Training ([train_models.py](file:///c:/NER-Connect/train_models.py))**  
   The script reads those 1,000 rows. It automatically figures out the pattern: *"If rain is high and slope is steep, probability of landslide is high."* It saves this logic into `models/landslide_model.joblib`.

3. **Step 3: Predicting Live ([segment_intelligence.py](file:///c:/NER-Connect/segment_intelligence.py))**  
   When a truck is about to enter **Segment 02**:
   - The code looks up the terrain at Segment 02: `Slope = 38%`.
   - The code looks up today's weather at Segment 02: `Rainfall = 140mm`.
   - It asks the saved model: *"What do you think?"*
   - The model answers: `"There is an 84% chance of a landslide."`
   - The code marks Segment 02 as **🔴 HIGH RISK** and warns the driver to take an alternative road.

---

## 5. Try It Yourself Right Now!

You can run the existing interactive test right in your terminal to see everything working together:

```bash
python test_run.py
```

### What you will see:
1. It will ask for road details (you can just press **Enter** to use the default Guwahati-to-Gangtok corridor).
2. It will ask: `Simulate heavy monsoon storm on road? (y/n)`.
   - If you type `n`, you will see normal safe green segments (🟢).
   - If you type `y`, it simulates torrential rain on the mountain segments, and you'll see the AI instantly flag them as 🔴 High Risk with delays!

---

## 6. What Are We Going to Build Next?

Now that the core intelligence works, the next steps in our project are:
1. **Dynamic Rerouting Engine**: If Segment 2 is blocked (🔴), find another path from the truck's current position to the destination.
2. **Offline Mode & Pre-caching**: When approaching an area marked as `"NO_SERVICE"`, download the route and safety cards in advance before internet is lost.
3. **User Interface / Web Dashboard**: Replace terminal text with an interactive map showing green, yellow, and red road corridors.
4. **Field Report Portal**: Allow road officers to report a fallen tree or blocked bridge from their phone.

---

*Keep this file handy! Whenever you feel lost while writing code, come back here to remember what each file is responsible for.*
