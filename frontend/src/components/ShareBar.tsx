import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { startTransfer } from '../api/scenarios';

type Props = { scenarioId: string; leaderToken: string };

export default function ShareBar({ scenarioId, leaderToken }: Props) {
  const shareUrl = `${window.location.origin}/s/${scenarioId}`;
  const [transferUrl, setTransferUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrCodeExpanded, setQrCodeExpanded] = useState(false);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt('Copy this link:', text);
    }
  }

  async function handleTransfer() {
    setBusy(true);
    try {
      const token = await startTransfer(scenarioId, leaderToken);
      setTransferUrl(`${window.location.origin}/s/${scenarioId}?transfer=${token}`);
    } catch (e) {
      alert('Could not generate transfer link: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="share-bar">
      <div className="share-row">
        <label>Share URL</label>
        <input readOnly value={shareUrl} onFocus={e => e.target.select()} />
        <button onClick={() => copy(shareUrl, 'share')}>
          {copied === 'share' ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="share-row">
        <button onClick={handleTransfer} disabled={busy}>
          {busy ? 'Generating…' : 'Generate transfer link'}
        </button>
        {transferUrl && (
          <>
            <input readOnly value={transferUrl} onFocus={e => e.target.select()} />
            <button onClick={() => copy(transferUrl, 'transfer')}>
              {copied === 'transfer' ? 'Copied!' : 'Copy'}
            </button>
          </>
        )}
      </div>
      {transferUrl && (
        <>
          <div className="qr-code-section">
            <button
              className="qr-toggle-btn"
              onClick={() => setQrCodeExpanded(!qrCodeExpanded)}
              aria-expanded={qrCodeExpanded}
            >
              {qrCodeExpanded ? '▼ Hide QR Code' : '▶ Show QR Code'}
            </button>
            {qrCodeExpanded && (
              <div className="qr-code-container">
                <QRCodeSVG value={transferUrl} size={200} level="H" includeMargin={true} />
              </div>
            )}
          </div>
          <p className="share-hint">Send this link to a teammate. When they accept, you become a member.</p>
        </>
      )}
    </div>
  );
}
