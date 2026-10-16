import { useCallback, useEffect, useRef, useState } from 'react'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import { coachingMutation } from '../../lib/coaching/api.js'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import { Button, SkeletonRow } from '../../components/ui.jsx'

const emptyForm = () => ({ displayName: '', businessTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, whatsAppNumber: '' })

export default function TrainerSettings() {
  const { userId, bootstrap, loadBootstrap, save } = useCoachingStore()
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [profileState, setProfileState] = useState({ userId, ready: false, loading: true, error: '' })
  const generation = useRef(0)
  const loadSequence = useRef(0)
  const savingRef = useRef(false)
  const loadProfile = useCallback(async () => {
    const request = ++loadSequence.current
    const accountGeneration = generation.current
    const current = () => request === loadSequence.current && accountGeneration === generation.current && useCoachingStore.getState().userId === userId
    setProfileState(previous => ({ ...previous, userId, loading: true, error: '' }))
    try {
      const result = await loadBootstrap()
      if (!current()) return null
      if (!result) throw new Error('Could not load your studio profile. Try again.')
      const profile = result.trainerProfile
      setForm(profile ? { displayName: profile.displayName || '', businessTimeZone: profile.businessTimeZone || '', whatsAppNumber: profile.whatsAppNumber || '' } : emptyForm())
      setProfileState({ userId, ready: true, loading: false, error: '' })
      return result
    } catch (error) {
      if (current()) setProfileState(previous => ({ ...previous, ready: [401, 403, 404].includes(error.status) ? false : previous.ready, loading: false, error: error.message }))
      return null
    }
  }, [userId, loadBootstrap])
  useEffect(() => {
    generation.current += 1
    savingRef.current = false
    setForm(emptyForm()); setMessage(''); setSaveError(''); setSaving(false)
    setProfileState({ userId, ready: false, loading: true, error: '' })
    loadProfile()
    return () => { generation.current += 1; loadSequence.current += 1 }
  }, [userId, loadProfile])
  const state = profileState.userId === userId ? profileState : { ready: false, loading: true, error: '' }
  const busy = saving || state.loading
  const submit = async e => {
    e.preventDefault()
    if (savingRef.current || !state.ready || state.loading || state.error) return
    const accountGeneration = generation.current
    const current = () => accountGeneration === generation.current && useCoachingStore.getState().userId === userId
    savingRef.current = true; setSaving(true); setMessage(''); setSaveError('')
    try {
      await save(() => coachingMutation('/profile', { expectedVersion: bootstrap?.trainerProfile?.version || 0, ...form }, { method: 'PUT' }))
      if (!current()) return
      const refreshed = await loadProfile()
      if (current()) setMessage(refreshed ? 'Saved' : 'Settings saved. Reload the profile to confirm the latest details.')
    } catch (error) { if (current()) setSaveError(error.message) }
    finally { if (current()) { savingRef.current = false; setSaving(false) } }
  }
  return <CoachingShell mode="trainer" title="Studio settings" eyebrow="Trainer Studio">
    {state.error && <div className="coaching-error" role="alert"><p>{state.error}</p><div className="coaching-actions"><Button disabled={busy} onClick={loadProfile}>Try again</Button></div></div>}
    {!state.ready && state.loading && <section className="coaching-panel" role="status" aria-label="Loading studio profile"><SkeletonRow /><SkeletonRow /></section>}
    {state.ready && <form className="coaching-panel coaching-form" onSubmit={submit}>
      <div><h2>Trainer identity</h2><p>This name and contact information are shown to invited clients.</p></div>
      <label><span>Display or business name</span><input disabled={busy} required maxLength="80" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} /></label>
      <label><span>Business time zone</span><input disabled={busy} required value={form.businessTimeZone} onChange={e => setForm({ ...form, businessTimeZone: e.target.value })} /></label>
      <label><span>WhatsApp number, optional</span><input disabled={busy} placeholder="+919876543210" value={form.whatsAppNumber} onChange={e => setForm({ ...form, whatsAppNumber: e.target.value })} /><small>Use international format. Chats open only when the client taps the button.</small></label>
      {saveError && <div className="coaching-error" role="alert">{saveError}</div>}
      <div className="coaching-actions"><Button disabled={busy || Boolean(state.error)} variant="primary" type="submit">{saving ? 'Saving…' : state.loading ? 'Loading…' : 'Save settings'}</Button>{message && <span role="status">{message}</span>}</div>
    </form>}
  </CoachingShell>
}
