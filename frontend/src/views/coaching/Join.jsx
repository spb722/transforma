import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { coachingApi, coachingMutation } from '../../lib/coaching/api.js'
import { buildAcceptance, clearJoinIntent, rememberJoinIntent } from '../../lib/coaching/join.js'
import Login from '../Login.jsx'
import Icon from '../../components/Icon.jsx'
import { Button, Check } from '../../components/ui.jsx'

export default function Join() {
  const { token } = useParams()
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [preview, setPreview] = useState(null)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let current = true
    rememberJoinIntent(token)
    setPreview(null)
    setAccepted(false)
    setError(null)
    coachingApi('/invitations/preview', { method: 'POST', body: { token }, signal: controller.signal })
      .then(data => {
        if (!current) return
        if (data.relationshipId) {
          clearJoinIntent()
          nav(`/coaching/${data.relationshipId}`, { replace: true })
        } else setPreview(data)
      })
      .catch(error => { if (current && error.name !== 'AbortError') setError(error) })
    return () => { current = false; controller.abort() }
  }, [token, user?.id, nav])

  const join = async () => {
    setBusy(true); setError(null)
    try {
      const relationship = await coachingMutation('/invitations/accept', buildAcceptance({ token, consentVersion: preview.consentVersion, confirmSharing: accepted }))
      clearJoinIntent()
      nav(`/coaching/${relationship.id}`, { replace: true })
    } catch (e) { setError(e) } finally { setBusy(false) }
  }

  return <div className="join-page">
    <section className="join-card">
      <div className="join-mark"><Icon name="dumbbell" /></div>
      <p className="join-kicker">Private coaching invitation</p>
      <h1>{preview ? `${preview.trainer.displayName} invited you` : 'Open your coaching invitation'}</h1>
      {!preview && !error && <p className="coaching-muted">Checking this invitation…</p>}
      {error && <div className="coaching-error">{error.message}</div>}
      {error && !user && <div className="join-login">
        <p>If you already used this invitation, sign in with the same passkey to open your coaching.</p>
        <Login embedded allowGuest={false} />
      </div>}
      {preview && <>
        <div className="join-consent">
          <h2>What you will share</h2>
          <p>{preview.consentText}</p>
          <p className="coaching-muted">You or your trainer can end coaching later. Your own workout records stay with you.</p>
        </div>
        {!user ? <div className="join-login">
          <p>Sign in or create a passkey profile to continue. This invitation stays here while you do it.</p>
          <Login embedded allowGuest={false} />
        </div> : <>
          <label className="join-check"><Check checked={accepted} onChange={setAccepted} /><span>I understand and agree to share this information with {preview.trainer.displayName}.</span></label>
          <Button variant="primary" disabled={!accepted || busy} onClick={join}>{busy ? 'Joining…' : 'Join coaching'}</Button>
        </>}
      </>}
    </section>
  </div>
}
