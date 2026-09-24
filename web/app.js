// ==========================================================================
// NER-Connect: Frontend Application Logic
// Lightweight, Flat 2D, White & Green Design System
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Preset Corridors Configuration
  const PRESETS = {
    guwahati_gangtok: {
      name: "Guwahati-Gangtok Strategic Corridor",
      startLat: 26.1445,
      startLon: 91.7362,
      endLat: 27.3389,
      endLon: 88.6065
    },
    guwahati_shillong: {
      name: "Guwahati-Shillong Highland Corridor (NH-6)",
      startLat: 26.1445,
      startLon: 91.7362,
      endLat: 25.5788,
      endLon: 91.8933
    },
    silchar_aizawl: {
      name: "Silchar-Aizawl Border Highway (NH-306)",
      startLat: 24.8333,
      startLon: 92.7789,
      endLat: 23.7271,
      endLon: 92.7176
    },
    tezpur_tawang: {
      name: "Tezpur-Tawang Trans-Himalayan Highway (NH-13)",
      startLat: 26.6528,
      startLon: 92.7926,
      endLat: 27.5861,
      endLon: 91.8594
    }
  };

  // DOM Elements
  const presetSelect = document.getElementById("preset-select");
  const roadNameInput = document.getElementById("road-name-input");
  const startLatInput = document.getElementById("start-lat");
  const startLonInput = document.getElementById("start-lon");
  const endLatInput = document.getElementById("end-lat");
  const endLonInput = document.getElementById("end-lon");
  const evaluateBtn = document.getElementById("evaluate-btn");

  const corridorTitleBadge = document.getElementById("corridor-title-badge");
  const corridorDistanceBadge = document.getElementById("corridor-distance-badge");
  const headerEtaText = document.getElementById("header-eta-text");

  const summaryCard = document.getElementById("summary-card");
  const metricDist = document.getElementById("metric-dist");
  const metricEta = document.getElementById("metric-eta");
  const metricSectors = document.getElementById("metric-sectors");
  const metricSource = document.getElementById("metric-source");

  const sectorsList = document.getElementById("sectors-list");

  // Initialize Leaflet 2D Map
  const map = L.map("map", {
    zoomControl: true,
    attributionControl: true
  }).setView([26.7, 90.5], 7);

  // Clean Standard 2D OSM Tiles
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Feature Layers Group
  const routeLayersGroup = L.featureGroup().addTo(map);

  // Flat 2D Div Icon Generator
  function create2DIcon(emoji, bgClass = "") {
    return L.divIcon({
      html: `<div style="
        background: #ffffff;
        border: 2px solid #1b4332;
        border-radius: 4px;
        padding: 2px 4px;
        font-size: 14px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        cursor: pointer;
      ">${emoji}</div>`,
      className: `custom-2d-marker ${bgClass}`,
      iconSize: [26, 26],
      iconAnchor: [13, 26],
      popupAnchor: [0, -26]
    });
  }

  // Handle Preset Changes
  presetSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val in PRESETS) {
      const p = PRESETS[val];
      roadNameInput.value = p.name;
      startLatInput.value = p.startLat;
      startLonInput.value = p.startLon;
      endLatInput.value = p.endLat;
      endLonInput.value = p.endLon;
    }
  });

  // Main Route & Sector Intelligence Evaluation
  async function evaluateRoute() {
    evaluateBtn.disabled = true;
    const originalBtnText = evaluateBtn.innerHTML;
    evaluateBtn.innerHTML = "Computing Route &amp; Evaluating Sectors...";

    sectorsList.innerHTML = `
      <div class="loading-placeholder">
        <div style="font-size: 16px; font-weight: 600; color: #1b4332; margin-bottom: 6px;">
          Calculating OSRM Route &amp; Evaluating Sector Risk...
        </div>
        <div>Processing physical elevation, upstream ISRO/CWC alert score, and ground baseline.</div>
      </div>
    `;

    headerEtaText.innerText = "Calculating...";

    const selectedScenario = document.querySelector('input[name="scenario"]:checked')?.value || "1";

    const payload = {
      road_name: roadNameInput.value.trim(),
      start_lat: parseFloat(startLatInput.value),
      start_lon: parseFloat(startLonInput.value),
      end_lat: parseFloat(endLatInput.value),
      end_lon: parseFloat(endLonInput.value),
      scenario: selectedScenario
    };

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== "SUCCESS") {
        throw new Error(data.message || "Route evaluation failed");
      }

      // Update Overview Bar
      corridorTitleBadge.innerText = data.corridor;
      corridorDistanceBadge.innerText = `${data.total_distance_km} km Verified Road Route (${data.routing_source})`;
      headerEtaText.innerText = data.total_journey_eta;

      // Update Quick Summary Card
      summaryCard.classList.remove("hidden");
      metricDist.innerText = `${data.total_distance_km} km`;
      metricEta.innerText = data.total_journey_eta;
      metricSectors.innerText = `${data.sectors.length} sectors (all ≥ 50 km)`;
      metricSource.innerText = data.routing_source;

      // Clear previous map layers
      routeLayersGroup.clearLayers();

      // Render Each Sector on Leaflet Map
      if (data.sectors && data.sectors.length > 0) {
        data.sectors.forEach((sec, idx) => {
          let strokeColor = "#2d6a4f"; // Safe (Green)
          let weight = 5;

          if (sec.risk_level === "danger") {
            strokeColor = "#dc2626"; // Critical (Red)
            weight = 6;
          } else if (sec.risk_level === "caution") {
            strokeColor = "#d97706"; // Caution (Amber)
            weight = 5;
          }

          if (sec.polyline && sec.polyline.length > 1) {
            const polyline = L.polyline(sec.polyline, {
              color: strokeColor,
              weight: weight,
              opacity: 0.9,
              smoothFactor: 1.0
            }).addTo(routeLayersGroup);

            // Sector popup
            polyline.bindPopup(`
              <div style="font-family: inherit; font-size: 13px; line-height: 1.4;">
                <strong style="color: #1b4332;">${sec.segment_id}: ${sec.road_name}</strong><br/>
                <b>Distance:</b> ${sec.distance} | <b>ETA:</b> ${sec.eta}<br/>
                <b>Condition:</b> ${sec.road_condition}<br/>
                <b>Upstream Feed:</b> ${sec.upstream_feed}<br/>
                <b>Elevation:</b> ${sec.elevation}
              </div>
            `);
          }
        });
      } else if (data.full_polyline && data.full_polyline.length > 0) {
        L.polyline(data.full_polyline, {
          color: "#2d6a4f",
          weight: 5,
          opacity: 0.9
        }).addTo(routeLayersGroup);
      }

      // Add Start & End Markers
      if (payload.start_lat && payload.start_lon) {
        L.marker([payload.start_lat, payload.start_lon], {
          icon: create2DIcon("🚩")
        }).bindPopup(`<b>Origin:</b> ${payload.road_name.split("➔")[0] || "Start"}`).addTo(routeLayersGroup);
      }

      if (payload.end_lat && payload.end_lon) {
        L.marker([payload.end_lat, payload.end_lon], {
          icon: create2DIcon("🏁")
        }).bindPopup(`<b>Destination:</b> ${payload.road_name.split("➔")[1] || "Destination"}`).addTo(routeLayersGroup);
      }

      // Add Junction Markers (spaced out cleanly to prevent clustering)
      if (data.junctions && data.junctions.length > 0) {
        let lastLat = null;
        let lastLon = null;
        data.junctions.forEach((j) => {
          const [jLat, jLon] = j.coords;
          // Simple distance filter (~30km apart minimum)
          if (lastLat === null || (Math.abs(jLat - lastLat) + Math.abs(jLon - lastLon)) > 0.35) {
            lastLat = jLat;
            lastLon = jLon;
            L.marker(j.coords, {
              icon: create2DIcon("🔀")
            }).bindPopup(`
              <div style="font-size: 12px;">
                <strong style="color: #1b4332;">🔀 Reroute Junction</strong><br/>
                <b>${j.name}</b><br/>
                <span style="color: #4b5563;">Divert traffic point</span>
              </div>
            `).addTo(routeLayersGroup);
          }
        });
      }

      // Add Bridge Markers
      if (data.bridges && data.bridges.length > 0) {
        data.bridges.forEach((b) => {
          L.marker(b.coords, {
            icon: create2DIcon("🌉")
          }).bindPopup(`
            <div style="font-size: 12px;">
              <strong style="color: #1b4332;">🌉 Strategic Bridge</strong><br/>
              <b>${b.name}</b><br/>
              <span style="color: #4b5563;">Critical water level monitoring</span>
            </div>
          `).addTo(routeLayersGroup);
        });
      }

      // Add Sector Checkpoint Markers from Embedded Milestones
      if (data.sectors && data.sectors.length > 0) {
        data.sectors.forEach((sec) => {
          if (sec.embedded_milestones && sec.embedded_milestones.length > 0) {
            sec.embedded_milestones.forEach((m) => {
              if (m.type.includes("CHECKPOINT") && sec.start_coords) {
                L.marker(sec.start_coords, {
                  icon: create2DIcon("🛡️")
                }).bindPopup(`
                  <div style="font-size: 12px;">
                    <strong style="color: #1b4332;">🛡️ Control Checkpoint</strong><br/>
                    <b>${m.name}</b> (${m.km_marker})<br/>
                    <span style="color: #4b5563;">${m.action}</span>
                  </div>
                `).addTo(routeLayersGroup);
              }
            });
          }
        });
      }

      // Fit map view to route bounds
      if (routeLayersGroup.getLayers().length > 0) {
        map.fitBounds(routeLayersGroup.getBounds(), { padding: [25, 25] });
      }

      // Render Sector Cards
      renderSectorCards(data.sectors);

    } catch (err) {
      console.error("Evaluation error:", err);
      sectorsList.innerHTML = `
        <div class="loading-placeholder" style="border-color: #dc2626; color: #dc2626; background: #fff5f5;">
          <strong>Error evaluating corridor:</strong> ${err.message}
        </div>
      `;
      headerEtaText.innerText = "Error";
    } finally {
      evaluateBtn.disabled = false;
      evaluateBtn.innerHTML = originalBtnText;
    }
  }

  // Render Sector Cards List
  function renderSectorCards(sectors) {
    if (!sectors || sectors.length === 0) {
      sectorsList.innerHTML = '<div class="loading-placeholder">No sectors generated for this corridor.</div>';
      return;
    }

    let html = "";

    sectors.forEach((sec) => {
      const riskClass = sec.risk_level || "safe";
      const advisoryClass = sec.risk_level === "danger" ? "hazard" : (sec.risk_level === "caution" ? "warning" : "");

      // Embedded Milestones
      let milestonesHtml = "";
      if (sec.embedded_milestones && sec.embedded_milestones.length > 0) {
        const items = sec.embedded_milestones.map((m) => `
          <li class="milestone-item">
            <span class="milestone-km">[${m.km_marker}]</span>
            <strong>${m.type}:</strong> ${m.name}
            <span style="color: #6b7280; margin-left: 4px;">— ${m.action}</span>
          </li>
        `).join("");

        milestonesHtml = `
          <div class="milestones-box">
            <div class="milestones-title">📍 Strategic Milestones Inside Sector:</div>
            <ul class="milestones-list">${items}</ul>
          </div>
        `;
      }

      html += `
        <article class="sector-card">
          <div class="sector-header">
            <div>
              <span class="sector-id-badge">${sec.segment_id}</span>
              <span class="sector-type-title">${sec.segment_type}</span>
              <div class="sector-name-sub">${sec.road_name}</div>
            </div>
            <div>
              <span class="sector-health-pill ${riskClass}">${sec.road_condition}</span>
            </div>
          </div>

          <div class="sector-body">
            <div class="sector-metrics-grid">
              <div class="sector-metric-cell">
                <span class="cell-label">SECTOR DISTANCE</span>
                <span class="cell-value">${sec.distance}</span>
              </div>
              <div class="sector-metric-cell">
                <span class="cell-label">TRAVEL TIME</span>
                <span class="cell-value">${sec.eta}</span>
              </div>
              <div class="sector-metric-cell">
                <span class="cell-label">ELEVATION PROFILE</span>
                <span class="cell-value">${sec.elevation}</span>
              </div>
              <div class="sector-metric-cell">
                <span class="cell-label">CONNECTIVITY</span>
                <span class="cell-value">${sec.network}</span>
              </div>
            </div>

            <div class="sector-intel-row">
              <div class="intel-box">
                <div class="intel-label">Upstream System Feed</div>
                <div class="intel-content">${sec.upstream_feed}</div>
              </div>
              <div class="intel-box">
                <div class="intel-label">Local Ground Context</div>
                <div class="intel-content">Soil: <strong>${sec.local_soil}</strong> | Model Confidence: <strong>${sec.confidence}</strong></div>
              </div>
              <div class="intel-box">
                <div class="intel-label">Landslide Assessment</div>
                <div class="intel-content">${sec.landslide_risk}</div>
              </div>
              <div class="intel-box">
                <div class="intel-label">Flood Assessment</div>
                <div class="intel-content">${sec.flood_risk}</div>
              </div>
            </div>

            ${milestonesHtml}

            <div class="status-advisory-box ${advisoryClass}">
              <strong>Sector Advisory:</strong> ${sec.status}
            </div>
          </div>
        </article>
      `;
    });

    sectorsList.innerHTML = html;
  }

  // Event Listeners
  evaluateBtn.addEventListener("click", evaluateRoute);

  // Automatically execute the initial route evaluation on page load
  evaluateRoute();
});
