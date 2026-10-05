import { useEffect, useState } from 'react';
import client from '../../api/client.js';

export default function AdminEmergency() {
  const [form, setForm] = useState({ enabled: true, callActions: true, note: '', helplines: [] });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    client.get('/admin/emergency-config')
      .then(({ data }) => setForm(data.emergency || { enabled: true, callActions: true, helplines: [] }))
      .catch((e) => setErr(e.response?.data?.message || 'Failed to load emergency config'));
  };

  useEffect(load, []);

  const setLine = (i, k, v) =>
    setForm((f) => ({ ...f, helplines: (f.helplines || []).map((h, idx) => (idx === i ? { ...h, [k]: v } : h)) }));

  const addLine = () =>
    setForm((f) => ({ ...f, helplines: [...(f.helplines || []), { id: `line-${Date.now()}`, label: '', number: '', icon: '📞' }] }));

  const removeLine = (i) =>
    setForm((f) => ({ ...f, helplines: (f.helplines || []).filter((_, idx) => idx !== i) }));

  const save = async () => {
    setSaving(true); setMsg(''); setErr('');
    try {
      const body = {
        enabled: form.enabled,
        callActions: form.callActions,
        note: form.note || undefined,
        helplines: (form.helplines || []).filter((h) => String(h.number || '').trim()),
      };
      const { data } = await client.put('/admin/emergency-config', body);
      setForm(data.emergency);
      setMsg('Emergency helpline config saved ✓');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to save emergency config');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setForm({ enabled: true, callActions: true, note: 'Call the nearest applicable helpline. Your real-time trip location has also been shared with our monitoring team.', helplines: [
      { id: 'police', label: 'Police — National Emergency', number: '100', icon: '👮' },
      { id: 'fire', label: 'Fire Brigade', number: '101', icon: '🚒' },
      { id: 'ambulance', label: 'Ambulance (Emergency)', number: '108', icon: '🚑' },
      { id: 'ambulance2', label: 'Health Help / Ambulance', number: '102', icon: '🏥' },
      { id: 'unified', label: 'Unified National Emergency (Police/Ambulance/Fire)', number: '112', icon: '🆘' },
      { id: 'women', label: 'Women Helpline', number: '1091', icon: '🚺' },
      { id: 'child', label: 'Child Helpline', number: '1098', icon: '🧒' },
      { id: 'disaster', label: 'Disaster Management', number: '1078', icon: '🌊' },
      { id: 'elderly', label: 'Senior Citizens Helpline', number: '14567', icon: '🧓' },
      { id: 'cyber', label: 'Cyber Crime Helpline', number: '1930', icon: '🖥️' },
    ] });
  };

  return (
    <div className="page">
      <div className="spread">
        <h2>🆘 Emergency Helplines</h2>
        <button className="btn btn-ghost" onClick={resetDefaults}>↺ Reset to India defaults</button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Official GoI emergency numbers shown inside the SOS flow with one-tap dial. Served to riders via{' '}
        <code>/api/emergency-config</code> and attached to every SOS event for the monitoring team.
      </p>

      {err && <div className="err-box">{err}</div>}
      {msg && <div className="alert alert-green">{msg}</div>}

      <div className="card">
        <div className="spread" style={{ marginBottom: 10 }}>
          <label className="checkbox-row" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
            <span className="small">Show helplines in SOS</span>
          </label>
          <label className="checkbox-row" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <input type="checkbox" checked={form.callActions !== false} onChange={(e) => setForm((f) => ({ ...f, callActions: e.target.checked }))} />
            <span className="small">Enable one-tap call buttons</span>
          </label>
        </div>

        <div className="field">
          <label>Note shown with the helplines</label>
          <textarea className="input" rows={2} value={form.note || ''} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </div>

        <h4 style={{ marginBottom: 6 }}>Helpline numbers</h4>
        <p className="small muted" style={{ marginTop: 0 }}>First item shown first; the unified 112 is automatically highlighted whenever present.</p>
        {(form.helplines || []).map((h, i) => (
          <div key={`${h.id || i}-${i}`} className="row" style={{ gap: 6, marginBottom: 8 }}>
            <input
              className="input" style={{ width: 56 }} value={h.icon || '📞'} maxLength={4}
              onChange={(e) => setLine(i, 'icon', e.target.value)} placeholder="😀"
            />
            <input
              className="input" style={{ flex: 1 }} value={h.label || ''}
              onChange={(e) => setLine(i, 'label', e.target.value)} placeholder="Service name"
            />
            <input
              className="input" style={{ width: 120 }} value={h.number || ''}
              onChange={(e) => setLine(i, 'number', e.target.value)} placeholder="Number (e.g. 112)"
            />
            <button className="btn btn-ghost" onClick={() => removeLine(i)} disabled={(form.helplines || []).length <= 1}>✕</button>
          </div>
        ))}
        <button className="btn btn-ghost" onClick={addLine}>+ Add helpline</button>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save emergency config'}
          </button>
        </div>
      </div>
    </div>
  );
}