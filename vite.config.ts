import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

interface TwilioConfig {
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
}

// Relays SMS dispatches to Twilio so the auth token stays server-side.
const twilioSmsPlugin = (twilio: TwilioConfig) => ({
  name: 'twilio-sms-gateway',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      // Twilio SMS Gateway: POST /api/sms/twilio-dispatch
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

            const { accountSid, authToken, fromNumber } = twilio;
            if (!accountSid || !authToken || !fromNumber) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                error: 'Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER in .env',
              }));
              return;
            }

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
export default defineConfig(({ mode }) => {
  // Secrets come from .env (git-ignored); see .env.example. The '' prefix loads non-VITE_ vars
  // for server-side use only — they are never exposed to browser code.
  const env = loadEnv(mode, process.cwd(), '');
  // Python backend (external_repo/app.py); override with API_URL to run a second copy elsewhere.
  const apiTarget = env.API_URL || 'http://127.0.0.1:5000';

  return {
    plugins: [
      react(),
      tailwindcss(),
      twilioSmsPlugin({
        accountSid: env.TWILIO_ACCOUNT_SID,
        authToken: env.TWILIO_AUTH_TOKEN,
        fromNumber: env.TWILIO_FROM_NUMBER,
      }),
    ],
    server: {
      port: 5173,
      host: true,
      allowedHosts: true,
      // external_repo is the separate Python backend: it writes route/geocode/elevation
      // caches to external_repo/data on every request, and without this the dev server
      // treats each write as a source change and force-reloads the page mid-journey.
      watch: { ignored: ['**/external_repo/**'] },
      proxy: {
        // Route calculation & sector intelligence are served by the Python backend (external_repo/app.py)
        '/api/evaluate': apiTarget,
        '/api/route-options': apiTarget,
        '/api/reroute': apiTarget,
      },
    },
  };
})
