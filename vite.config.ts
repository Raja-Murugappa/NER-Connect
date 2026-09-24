import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { WebSocketServer, WebSocket } from 'ws'

// Dedicated WebSocket server on port 8080 for free real-time Wi-Fi push notifications
const WS_PORT = 8080;
let wss: WebSocketServer | null = (globalThis as any).__geoTagWsServer || null;

function initWsServer() {
  if (!wss) {
    try {
      wss = new WebSocketServer({ port: WS_PORT, host: '0.0.0.0' }, () => {
        console.log(`\n📡 [Local Push] WebSocket server active on ws://0.0.0.0:${WS_PORT}`);
      });
      (globalThis as any).__geoTagWsServer = wss;

      wss.on('connection', (ws, req) => {
        const clientIp = req.socket.remoteAddress || 'unknown';
        console.log(`[Local Push WS] Peer connected: ${clientIp}`);

        ws.on('close', () => {
          console.log(`[Local Push WS] Peer disconnected: ${clientIp}`);
        });

        // Send connection confirmation
        ws.send(JSON.stringify({
          type: 'connected',
          title: 'NER-Connect Push Server',
          message: 'Connected to local Wi-Fi notification gateway on port 8080',
          timestamp: new Date().toISOString()
        }));
      });

      wss.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.log('[Local Push WS] Port 8080 is already active and listening.');
        } else {
          console.error('[Local Push WS Error]:', err);
        }
      });
    } catch (err: any) {
      console.warn(`[Local Push WS] Notice: ${err.message}`);
    }
  }
  return wss;
}

function broadcastNotification(title: string, message: string) {
  const server = initWsServer();
  if (!server) return 0;

  const payload = JSON.stringify({
    title,
    message,
    timestamp: new Date().toISOString()
  });

  let count = 0;
  server.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      count++;
    }
  });
  console.log(`[Local Push WS] Broadcast: "${title}" sent to ${count} peer(s)`);
  return count;
}

const localPushPlugin = () => ({
  name: 'local-push-notifications',
  configureServer(server: any) {
    initWsServer();
    server.middlewares.use(async (req: any, res: any, next: any) => {
      // 1. Broadcast endpoint: POST /api/notifications/broadcast
      if (req.url === '/api/notifications/broadcast' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const title = data.title || 'NER-Connect Alert';
            const message = data.message || 'Notification broadcast from local gateway';
            const count = broadcastNotification(title, message);

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              deliveredTo: count,
              title,
              message,
              port: WS_PORT
            }));
          } catch (err: any) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // 2. Status endpoint: GET /api/notifications/status
      if (req.url === '/api/notifications/status' && req.method === 'GET') {
        const server = initWsServer();
        const clientCount = server ? server.clients.size : 0;
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({
          active: true,
          port: WS_PORT,
          connectedPeers: clientCount,
          wsUrl: `ws://10.1.201.165:${WS_PORT}`
        }));
        return;
      }

      // 3. Twilio SMS Gateway: POST /api/sms/twilio-dispatch
      if (req.url === '/api/sms/twilio-dispatch' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const to = data.to;
            const message = data.message || 'sms_customer_support';

            const accountSid = 'AC776bca6751a23f0c0e01351ffad5b814';
            const authToken = 'd55a1863bed24fe77506e661327f73b8';
            const fromNumber = '+17372583478';

            const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
            const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

            const sendTwilio = async (msgBody: string) => {
              const params = new URLSearchParams();
              params.append('To', to);
              params.append('From', fromNumber);
              params.append('Body', msgBody);

              const twilioRes = await fetch(url, {
                method: 'POST',
                headers: {
                  'Authorization': authHeader,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
              });
              return await twilioRes.json();
            };

            let twilioData: any = await sendTwilio(message);

            // If error 572006 (Twilio trial template restriction for India), fallback to pre-approved trial template
            if (twilioData.code === 572006) {
              const fallbackTemplate = message.toLowerCase().includes('alert') || message.toLowerCase().includes('hazard')
                ? 'sms_internal_alerts'
                : 'sms_customer_support';
              twilioData = await sendTwilio(fallbackTemplate);
            }

            // Also broadcast this dispatch as a real-time push to all connected friend laptops on Wi-Fi!
            broadcastNotification(
              `SMS Dispatched: ${to}`,
              `Dispatched via Twilio (${twilioData.sid || 'Active'}): ${message.slice(0, 100)}`
            );

            res.setHeader('Content-Type', 'application/json');
            if (twilioData.sid) {
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                sid: twilioData.sid,
                status: twilioData.status || 'queued',
                to: twilioData.to,
                body: twilioData.body,
              }));
            } else {
              res.statusCode = 400;
              res.end(JSON.stringify({
                success: false,
                error: twilioData.message || 'Twilio dispatch failed',
                code: twilioData.code,
              }));
            }
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }
      next();
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), localPushPlugin()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
  },
})
