import { useEffect, useRef, useState } from 'react'
import { coachingApi, coachingMutation, mutationId } from '../../lib/coaching/api.js'
import { dateInZone } from '../../lib/coaching/dates.js'
import { Button } from '../ui.jsx'
import { useStore } from '../../store/useStore.js'
import './contact-client.css'

export default function ContactClient({ workspace, mode }) {
  const id = workspace.relationship.id
  const userId = useStore(state => state.user?.id)
  const alive = useRef(false)
  const identity = `${userId}:${id}:${mode}:${workspace.relationship.status}`
  const latest = useRef(identity)
  latest.current = identity
  const current = () => Boolean(userId) && alive.current && latest.current === identity && useStore.getState().user?.id === userId
  const [data, setData] = useState(null)
  const [number, setNumber] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [date, setDate] = useState(() => dateInZone(new Date(), workspace.relationship.timeZone))
  const [occurrenceId, setOccurrenceId] = useState('')
  const [opened, setOpened] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const confirmationRequest = useRef(null)
  const rows = (workspace.occurrences || workspace.workout?.occurrences || []).filter(row => row.scheduledDate === date)
  const occurrence = rows.find(row => row.id === occurrenceId)
  const active = workspace.relationship.status === 'active'
  const load = () => coachingApi(`/contact?relationshipId=${encodeURIComponent(id)}`)
  useEffect(() => {
    let canceled = false
    alive.current = true
    setBusy(false); setOpened(false); setConfirmed(false); confirmationRequest.current = null
    load().then(value => { if (!canceled && current()) { setData(value); setNumber(value.whatsAppNumber || ''); setConsent(value.enabled) } }).catch(e => { if (!canceled && current()) setError(e.message) })
    return () => { canceled = true; alive.current = false }
  }, [identity])
  useEffect(() => { setOpened(false); setConfirmed(false); confirmationRequest.current = null }, [date, occurrenceId])
  const reload = async () => {
    if (!current() || busy) return
    setBusy(true)
    try {
      const value = await load()
      if (!current()) return
      setData(value); setNumber(value.whatsAppNumber || ''); setConsent(value.enabled); setError('')
    } catch (e) { if (current()) setError(e.message) }
    finally { if (current()) setBusy(false) }
  }
  const save = async (enabled) => {
    if (!current() || busy || !active) return
    setBusy(true); setError('')
    try {
      const value = await coachingMutation('/contact/preference', { relationshipId: id, expectedVersion: data.version, enabled, whatsAppNumber: number })
      if (!current()) return
      setData(value); setConsent(value.enabled); setNumber(value.whatsAppNumber || '')
    } catch (e) {
      if (!current()) return
      setError(e.message)
      try { const value = await load(); if (current()) setData(value) } catch {}
    }
    finally { if (current()) setBusy(false) }
  }
  const open = async () => {
    if (!current() || busy || !active) return
    // Reserve the tab during the click; consent is rechecked before its destination is set.
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    setBusy(true); setError('')
    try {
      const fresh = await load()
      if (!current()) { tab?.close(); return }
      setData(fresh)
      if (!fresh.enabled) throw new Error('The client has not shared a WhatsApp contact number.')
      if (!tab) throw new Error('Allow a new tab in your browser, then try again.')
      const message = `Hi ${workspace.client?.name || 'there'}, checking in about ${occurrence?.prescription?.dayName || 'your workout'} on ${date}. How did it go?`
      tab.location.href = `https://wa.me/${fresh.whatsAppNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
      setOpened(true)
    } catch (e) { tab?.close(); if (current()) { setOpened(false); setError(e.message) } }
    finally { if (current()) setBusy(false) }
  }
  const mark = async () => {
    if (!current() || busy || !active || !confirmed) return
    setBusy(true); setError('')
    try {
      confirmationRequest.current ||= { mutationId: mutationId(), relationshipId: id, expectedVersion: data.version, scheduledDate: date, occurrenceId: occurrence?.id || null, confirmedSent: confirmed }
      const value = await coachingMutation('/contact/confirm', confirmationRequest.current)
      if (!current()) return
      confirmationRequest.current = null
      setData(value); setOpened(false); setConfirmed(false)
    } catch (e) {
      if (!current()) return
      if (e.status && e.status < 500) confirmationRequest.current = null
      setError(e.message)
      try { const value = await load(); if (current()) setData(value) } catch {}
    }
    finally { if (current()) setBusy(false) }
  }
  const last = data?.contacts.find(row => row.scheduledDate === date && row.occurrenceId === (occurrence?.id || null))
  return <section className="coaching-panel contact-client">
    <h2>{mode === 'client' ? 'Share contact with trainer' : 'Contact client'}</h2>
    {error && <p role="alert" className="coaching-error">{error}</p>}
    {!data ? <><p>Contact preference unavailable or loading.</p><Button disabled={busy} onClick={reload}>Reload contact</Button></> : mode === 'client' ? <>
      <p>Choose whether this trainer may contact you on WhatsApp about your workouts. No messages or reminders are sent automatically. You can revoke sharing here.</p>
      {active && <><label className="contact-client-field">WhatsApp number with country code<input disabled={busy} type="tel" autoComplete="tel" placeholder="+919876543210" value={number} onChange={e => setNumber(e.target.value)} /></label>
        <label className="contact-client-consent"><input disabled={busy} type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> I agree to share this number with my trainer for workout follow-up.</label>
        <div className="coaching-actions"><Button disabled={busy || !consent} onClick={() => save(true)}>Save contact sharing</Button>{data.enabled && <Button disabled={busy} onClick={() => save(false)}>Revoke contact sharing</Button>}</div></>}
      <p role="status">{data.enabled ? 'Contact sharing is on.' : 'Contact sharing is off.'}</p>
    </> : !data.enabled ? <p>The client has not shared a contact number. They can opt in from their coaching workspace.</p> : <>
      <p>Open a draft in WhatsApp, review it and send it yourself. Opening WhatsApp does not send a message.</p>
      <label className="contact-client-field">Workout date<input disabled={busy} type="date" value={date} onChange={e => { setDate(e.target.value); setOccurrenceId('') }} /></label>
      <label className="contact-client-field">Workout context<select disabled={busy} value={occurrenceId} onChange={e => setOccurrenceId(e.target.value)}><option value="">General workout follow-up</option>{rows.map(row => <option key={row.id} value={row.id}>{row.prescription?.dayName || 'Workout'}</option>)}</select></label>
      {last && <p role="status"><strong>Already marked contacted for this context:</strong> {new Date(last.confirmedAt).toLocaleString()}. Check before sending another message.</p>}
      <Button disabled={busy || !date || !active} onClick={open}>Open WhatsApp draft</Button>
      {opened && <><label className="contact-client-consent"><input disabled={busy} type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I sent the message myself in WhatsApp.</label><Button disabled={busy || !confirmed} onClick={mark}>Mark contacted</Button></>}
    </>}
    {!!data?.contacts.length && <><h3>Contact history</h3><p className="coaching-muted">Manually confirmed by the trainer. Delivery is not verified.</p>{data.contacts.slice(0, 5).map(row => <p key={row.id}>{row.scheduledDate} · {row.workoutName || 'Workout follow-up'} · Marked contacted {new Date(row.confirmedAt).toLocaleString()}</p>)}</>}
  </section>
}
