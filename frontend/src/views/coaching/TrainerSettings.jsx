import { useEffect, useState } from 'react'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import { coachingMutation } from '../../lib/coaching/api.js'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import { Button } from '../../components/ui.jsx'

export default function TrainerSettings() {
  const { bootstrap, loadBootstrap, save } = useCoachingStore()
  const [form, setForm] = useState({ displayName: '', businessTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, whatsAppNumber: '' })
  const [message, setMessage] = useState('')
  useEffect(() => { loadBootstrap().catch(() => {}) }, [loadBootstrap])
  useEffect(() => { const p = bootstrap?.trainerProfile; if (p) setForm({ displayName: p.displayName || '', businessTimeZone: p.businessTimeZone || '', whatsAppNumber: p.whatsAppNumber || '' }) }, [bootstrap])
  const submit = async e => {
    e.preventDefault(); setMessage('')
    try { await save(() => coachingMutation('/profile', { expectedVersion: bootstrap?.trainerProfile?.version || 0, ...form }, { method: 'PUT' })); await loadBootstrap(); setMessage('Saved') }
    catch (error) { setMessage(error.message) }
  }
  return <CoachingShell mode="trainer" title="Studio settings" eyebrow="Trainer Studio">
    <form className="coaching-panel coaching-form" onSubmit={submit}>
      <div><h2>Trainer identity</h2><p>This name and contact information are shown to invited clients.</p></div>
      <label><span>Display or business name</span><input required maxLength="80" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} /></label>
      <label><span>Business time zone</span><input required value={form.businessTimeZone} onChange={e => setForm({ ...form, businessTimeZone: e.target.value })} /></label>
      <label><span>WhatsApp number, optional</span><input placeholder="+919876543210" value={form.whatsAppNumber} onChange={e => setForm({ ...form, whatsAppNumber: e.target.value })} /><small>Use international format. Chats open only when the client taps the button.</small></label>
      <div className="coaching-actions"><Button variant="primary" type="submit">Save settings</Button>{message && <span role="status">{message}</span>}</div>
    </form>
  </CoachingShell>
}
