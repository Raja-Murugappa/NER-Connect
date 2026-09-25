// Drives headless Edge over CDP to smoke-test the journey/reroute/SMS flow.
const CDP_HTTP = 'http://127.0.0.1:9333';

async function newTab(url) {
  const res = await fetch(`${CDP_HTTP}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return res.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', reject);
  });
}

function send(ws, id, method, params = {}) {
  return new Promise((resolve) => {
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        resolve(msg);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

let msgId = 1;
async function evaluate(ws, expression, awaitPromise = false) {
  const id = msgId++;
  const res = await send(ws, id, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
  if (res.result?.exceptionDetails) {
    throw new Error(JSON.stringify(res.result.exceptionDetails));
  }
  return res.result?.result?.value;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const tab = await newTab('http://127.0.0.1:5202/');
  const ws = await connect(tab.webSocketDebuggerUrl);
  await send(ws, msgId++, 'Runtime.enable');
  await send(ws, msgId++, 'Page.enable');

  // Wait for the route to load (skeleton gone, sector table present)
  for (let i = 0; i < 40; i++) {
    const ready = await evaluate(ws, `!!document.querySelector('.data-table')`);
    if (ready) break;
    await sleep(500);
  }

  const title = await evaluate(ws, `document.querySelector('h1')?.textContent`);
  console.log('Page title (corridor name):', title);

  // Click "Start journey"
  const startClicked = await evaluate(ws, `
    (() => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find(x => x.textContent.trim().toLowerCase().includes('start journey'));
      if (!b) return 'NOT_FOUND: ' + btns.map(x=>x.textContent.trim()).join(' | ');
      b.click();
      return 'clicked';
    })()
  `);
  console.log('Start journey click:', startClicked);
  await sleep(1500);

  // Let the truck run for a couple seconds so it's not at index 0
  await sleep(3000);

  const truckState = await evaluate(ws, `
    (() => {
      const log = [...document.querySelectorAll('section')].find(s => s.querySelector('h2')?.textContent.includes('Journey log'));
      return log ? log.textContent.slice(0, 400) : 'no journey log yet';
    })()
  `);
  console.log('Journey log after start:', truckState);

  // Toggle "place disruption" mode
  const placeToggled = await evaluate(ws, `
    (() => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find(x => /disruption/i.test(x.textContent) && /place|report|mark/i.test(x.textContent));
      if (!b) return 'NOT_FOUND: ' + btns.map(x=>x.textContent.trim()).filter(Boolean).join(' | ');
      b.click();
      return 'clicked: ' + b.textContent.trim();
    })()
  `);
  console.log('Place-disruption toggle:', placeToggled);
  await sleep(500);

  // Find the leaflet map container and the truck marker's pixel position, then click well ahead of it.
  const clickInfo = await evaluate(ws, `
    (() => {
      const mapEl = document.querySelector('.leaflet-container');
      if (!mapEl) return { error: 'no map' };
      const rect = mapEl.getBoundingClientRect();
      // click roughly 70% across the map, vertically centered - likely along the route ahead
      const x = rect.left + rect.width * 0.65;
      const y = rect.top + rect.height * 0.4;
      return { x, y, w: rect.width, h: rect.height };
    })()
  `);
  console.log('Map click target:', clickInfo);

  if (!clickInfo.error) {
    await send(ws, msgId++, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x: clickInfo.x, y: clickInfo.y, button: 'left', clickCount: 1,
    });
    await send(ws, msgId++, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: clickInfo.x, y: clickInfo.y, button: 'left', clickCount: 1,
    });
  }

  await sleep(4000); // reroute check can take a few seconds (real OSRM calls)

  const afterClick = await evaluate(ws, `
    (() => {
      const log = [...document.querySelectorAll('section')].find(s => s.querySelector('h2')?.textContent.includes('Journey log'));
      const rerouteCard = [...document.querySelectorAll('.panel')].find(p => /Reroute|Disruption|blocked|detour/i.test(p.textContent));
      return {
        log: log ? log.textContent.slice(0, 800) : null,
        rerouteCardText: rerouteCard ? rerouteCard.textContent.slice(0, 800) : null,
      };
    })()
  `);
  console.log('=== AFTER CLICK ===');
  console.log('Journey log:', afterClick.log);
  console.log('Reroute card:', afterClick.rerouteCardText);

  await ws.close();
}

main().catch((e) => { console.error('TEST FAILED:', e); process.exit(1); });
