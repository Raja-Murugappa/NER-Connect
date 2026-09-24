// src/modules/notifications/LocalPushPanel.tsx
import React, { useState, useEffect } from 'react';
import { useLocalPushNotifications } from './useLocalPushNotifications';

export const LocalPushPanel: React.FC = () => {
  const { isConnected, permission, requestPermission, notifications } = useLocalPushNotifications();
  const [peerCount, setPeerCount] = useState<number>(0);
  const [hostIp, setHostIp] = useState<string>('10.1.201.165');
  const [title, setTitle] = useState<string>('NER-Connect Hazard Alert');
  const [message, setMessage] = useState<string>('Active roadblock reported on NH-27 near Shillong bypass.');
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const receiverUrl = `http://${hostIp}:5173/receiver.html`;

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/notifications/status');
      if (res.ok) {
        const data = await res.json();
        setPeerCount(data.connectedPeers || 0);
        if (window.location.hostname && window.location.hostname !== 'localhost') {
          setHostIp(window.location.hostname);
        }
      }
    } catch {
      // server offline
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleBroadcast = async () => {
    if (!title.trim() || !message.trim()) {
      setStatusMsg({ text: 'Please provide both title and message.', success: false });
      return;
    }

    setIsBroadcasting(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({
          text: `Broadcast sent to ${data.deliveredTo} connected peer(s) on Wi-Fi (ws://${hostIp}:8080)!`,
          success: true,
        });
      } else {
        setStatusMsg({ text: data.error || 'Broadcast failed', success: false });
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Network error', success: false });
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(receiverUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ner-card p-5 space-y-5">
      <div className="pb-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#1b4332] text-white text-[10px] font-bold px-2 py-0.5 rounded">
              P2P PUSH
            </span>
            <h3 className="ner-heading">Local Wi-Fi Push Notifications</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Free, zero-cloud real-time desktop notifications to friend laptops on the same Wi-Fi network
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
              isConnected
                ? 'bg-[#e8f5e9] text-[#1b5e20] border border-[#81c784]'
                : 'bg-[#ffebee] text-[#c62828] border border-[#e57373]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            {isConnected ? `ws://${hostIp}:8080 (Listening)` : 'Connecting to Port 8080...'}
          </span>
          <span className="bg-gray-100 border border-gray-300 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full">
            👥 {peerCount} Peer(s) Online
          </span>
        </div>
      </div>

      {/* Share With Friend Banner */}
      <div className="bg-[#f0f9f3] border border-[#a3d9b8] rounded-lg p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#1b4332] uppercase flex items-center gap-1.5">
            <span>💻</span> Share With Friend&apos;s Laptop on Same Wi-Fi
          </span>
          <span className="text-[10px] text-gray-500">Receiver Webpage</span>
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="text"
            readOnly
            value={receiverUrl}
            className="flex-1 text-xs p-2 border border-gray-300 rounded bg-white font-mono text-gray-700"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="bg-[#2d6a4f] hover:bg-[#1b4332] text-white text-xs font-bold px-3 py-2 rounded transition whitespace-nowrap"
          >
            {copied ? '✓ Copied URL!' : '📋 Copy URL'}
          </button>
          <a
            href="/receiver.html"
            target="_blank"
            rel="noreferrer"
            className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-bold px-3 py-2 rounded transition whitespace-nowrap"
          >
            Open Receiver Tab ↗
          </a>
        </div>

        <p className="text-[11px] text-gray-600">
          Have your friend open that link on their laptop browser, click <strong>&ldquo;Enable Desktop Notifications&rdquo;</strong>, and leave the tab open in the background.
        </p>
      </div>

      {/* Notification Permissions on Current Device */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
        <div>
          <span className="text-xs font-bold text-gray-800 block">Desktop Notifications on This Machine:</span>
          <span className="text-[11px] text-gray-500">
            Current status: <strong className="uppercase">{permission}</strong>
          </span>
        </div>
        {permission !== 'granted' && (
          <button
            type="button"
            onClick={requestPermission}
            className="bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold px-3 py-1.5 rounded transition"
          >
            🔔 Enable Notifications Here
          </button>
        )}
      </div>

      {/* Broadcast Form */}
      <div className="space-y-3 bg-[#f8faf8] border border-gray-200 rounded-lg p-4">
        <h4 className="text-xs font-bold text-[#1b4332] uppercase">Broadcast Instant Push</h4>

        {statusMsg && (
          <div
            className={`p-2.5 rounded text-xs flex items-center gap-2 ${
              statusMsg.success
                ? 'bg-[#e8f5e9] border border-[#81c784] text-[#1b5e20]'
                : 'bg-[#ffebee] border border-[#e57373] text-[#c62828]'
            }`}
          >
            <span>{statusMsg.success ? '✅' : '⚠️'}</span>
            <span className="font-semibold">{statusMsg.text}</span>
          </div>
        )}

        <div>
          <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">
            Notification Title
          </label>
          <input
            type="text"
            className="w-full text-xs p-2 border border-gray-300 rounded focus:outline-none focus:border-[#2d6a4f]"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Critical Road Alert"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">
            Notification Message
          </label>
          <textarea
            rows={2}
            className="w-full text-xs p-2 border border-gray-300 rounded focus:outline-none focus:border-[#2d6a4f]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Landslide reported on Sector 4. Diversion active."
          />
        </div>

        <button
          type="button"
          onClick={handleBroadcast}
          disabled={isBroadcasting}
          className="w-full bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold py-2.5 rounded shadow-xs uppercase tracking-wide transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isBroadcasting ? (
            'Broadcasting...'
          ) : (
            <>
              <span>📡</span>
              <span>Send Push to Connected Friend Laptops ({peerCount} Online)</span>
            </>
          )}
        </button>
      </div>

      {/* Recent Received Feed */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold text-gray-500 block">
            Recent Local Push Feed ({notifications.length})
          </span>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {notifications.map((n, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded p-2 text-xs flex justify-between items-start"
              >
                <div>
                  <span className="font-bold text-[#1b4332] block">{n.title}</span>
                  <span className="text-gray-600 text-[11px]">{n.message}</span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-2">
                  {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
