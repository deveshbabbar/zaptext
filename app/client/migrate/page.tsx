'use client';

import { useState, useEffect, CSSProperties } from 'react';
import { PageTopbar, PageHead, Panel } from '@/components/app/primitives';

interface Bot {
  client_id: string;
  business_name: string;
  type: string;
}

interface ImportResult {
  ok: boolean;
  accepted: number;
  skipped: number;
  detectedSource: string;
  warnings: string[];
  truncated?: boolean;
  truncatedAt?: number;
  message?: string;
  note?: string;
}

export default function ClientMigratePage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [csv, setCsv] = useState<string>('');
  const [filename, setFilename] = useState<string>('');
  const [source, setSource] = useState<string>('auto');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/client/bots')
      .then((r) => r.json())
      .then((d) => {
        const list: Bot[] = (d?.bots as Bot[]) || [];
        setBots(list);
        if (list.length > 0) setSelectedBotId(list[0].client_id);
      })
      .catch(() => setErr('Could not load your bots — please refresh.'));
  }, []);

  async function handleFile(file: File | null) {
    if (!file) return;
    setFilename(file.name);
    setResult(null);
    setErr(null);
    try {
      const text = await file.text();
      setCsv(text);
    } catch (e) {
      setErr(`Could not read file: ${String(e).slice(0, 200)}`);
    }
  }

  async function handleImport() {
    if (!csv) {
      setErr('Please upload a CSV file first.');
      return;
    }
    if (!selectedBotId) {
      setErr('Please pick a bot to import contacts into.');
      return;
    }
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch('/api/client/migrate-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, source, clientId: selectedBotId }),
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) {
        setErr(data.error || data.message || `HTTP ${res.status}`);
      }
      setResult(data);
    } catch (e) {
      setErr(String(e).slice(0, 200));
    } finally {
      setBusy(false);
    }
  }

  const previewLines = csv ? csv.split(/\r?\n/).slice(0, 6) : [];

  return (
    <>
      <PageTopbar crumbs={<>Client → Migrate contacts</>} />
      <PageHead
        title="Migrate from Wati / AiSensy"
        sub="Upload your contact CSV from Wati or AiSensy and we'll bring the list across in one go. We do NOT auto-message imported contacts — you stay in control of opt-in."
      />

      {err && (
        <Panel><div style={{ padding: 16, color: '#c33' }}>Error: {err}</div></Panel>
      )}

      <Panel>
        <div style={panelHead}>1. Pick the destination bot</div>
        <div style={{ padding: 16 }}>
          {bots.length === 0 ? (
            <div style={{ color: '#888' }}>You don&apos;t have any bots yet — create one first.</div>
          ) : (
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              style={inputStyle}
            >
              {bots.map((b) => (
                <option key={b.client_id} value={b.client_id}>
                  {b.business_name} — {b.type}
                </option>
              ))}
            </select>
          )}
        </div>
      </Panel>

      <Panel>
        <div style={panelHead}>2. Upload the CSV</div>
        <div style={{ padding: 16 }}>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
            style={{ display: 'block', marginBottom: 8 }}
          />
          {filename && (
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              Loaded: <b>{filename}</b> ({csv.length.toLocaleString()} bytes)
            </div>
          )}
          {previewLines.length > 0 && (
            <div style={previewBox}>
              {previewLines.map((l, i) => (
                <div key={i} style={previewLine}>
                  {l.slice(0, 200)}
                  {l.length > 200 ? '…' : ''}
                </div>
              ))}
              {csv.split(/\r?\n/).length > 6 && (
                <div style={{ ...previewLine, color: '#888', fontStyle: 'italic' }}>
                  …{csv.split(/\r?\n/).length - 6} more lines
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, color: '#444', marginRight: 8 }}>Source format:</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle}>
              <option value="auto">Auto-detect</option>
              <option value="wati">Wati</option>
              <option value="aisensy">AiSensy</option>
              <option value="generic">Generic CSV</option>
            </select>
          </div>
        </div>
      </Panel>

      <Panel>
        <div style={panelHead}>3. Import</div>
        <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={handleImport}
            disabled={busy || !csv || !selectedBotId}
            style={{
              ...btnStyle,
              opacity: busy || !csv || !selectedBotId ? 0.5 : 1,
              cursor: busy || !csv || !selectedBotId ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Importing…' : 'Import contacts'}
          </button>
          <span style={{ fontSize: 12, color: '#888' }}>
            We&apos;ll show a result summary below — no message goes out.
          </span>
        </div>
      </Panel>

      {result && (
        <Panel>
          <div style={panelHead}>Result</div>
          <div style={{ padding: 16, fontSize: 14, lineHeight: 1.7 }}>
            <div>
              <b>Accepted:</b>{' '}
              <span style={{ color: '#0a0' }}>{result.accepted.toLocaleString()}</span>
              {' · '}
              <b>Skipped:</b>{' '}
              <span style={{ color: '#888' }}>{result.skipped.toLocaleString()}</span>
              {' · '}
              <b>Detected source:</b>{' '}
              <span style={{ fontFamily: 'monospace' }}>{result.detectedSource}</span>
            </div>
            {result.truncated && (
              <div style={{ color: '#c80', marginTop: 8 }}>
                ⚠ Capped at {result.truncatedAt?.toLocaleString()} contacts. Split your CSV and run
                a second import for the rest.
              </div>
            )}
            {result.warnings.length > 0 && (
              <ul style={{ marginTop: 8, paddingLeft: 20, color: '#c80' }}>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            {result.note && (
              <div style={{ marginTop: 12, padding: 12, background: '#fff5e0', border: '1px solid #f0c060', borderRadius: 6, color: '#553' }}>
                <b>📌 Important:</b> {result.note}
              </div>
            )}
          </div>
        </Panel>
      )}

      <Panel>
        <div style={panelHead}>What gets imported?</div>
        <div style={{ padding: 16, fontSize: 13, color: '#444', lineHeight: 1.7 }}>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>
              <b>Phone numbers</b> — normalised to E.164 (+91 added if missing for Indian numbers)
            </li>
            <li><b>Names</b> — copied verbatim, capped at 200 chars</li>
            <li><b>Tags / traits</b> — preserved as a comma-separated note on the contact row</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            <b>What does NOT get imported:</b> conversation history, Meta-approved templates
            (those live with your WhatsApp Business Account, not Wati/AiSensy), or any opt-in
            consent records (you must demonstrate opt-in independently).
          </p>
          <p style={{ marginTop: 8, color: '#888' }}>
            How to export from Wati: Contacts page → ⋯ menu → Export. From AiSensy: Contacts → Export
            CSV.
          </p>
        </div>
      </Panel>
    </>
  );
}

const panelHead: CSSProperties = {
  padding: '12px 16px',
  fontWeight: 600,
  borderBottom: '1px solid #eee',
};
const inputStyle: CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #ddd',
  borderRadius: 6,
  fontSize: 14,
  background: '#fff',
};
const btnStyle: CSSProperties = {
  padding: '10px 20px',
  background: '#222',
  color: '#fff',
  border: 0,
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
};
const previewBox: CSSProperties = {
  background: '#f7f7f8',
  border: '1px solid #e5e5e7',
  borderRadius: 6,
  padding: 12,
  fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  fontSize: 12,
  marginTop: 8,
  maxHeight: 180,
  overflow: 'auto',
};
const previewLine: CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
