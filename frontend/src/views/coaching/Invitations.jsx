import { useCallback, useEffect, useRef, useState } from 'react'
import { coachingApi, coachingMutation } from '../../lib/coaching/api.js'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import { Button, StatusBadge, EmptyState, SkeletonRow } from '../../components/ui.jsx'
import { confirmSheet } from '../../sheets.jsx'

export default function Invitations() {
  const bootstrap = useCoachingStore(s => s.bootstrap)
  const userId = useCoachingStore(s => s.userId)
  const loadBootstrap = useCoachingStore(s => s.loadBootstrap)
  const [items, setItems] = useState(null)
  const [share, setShare] = useState(null)
  const [error, setError] = useState('')
  const [profileError, setProfileError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copyState, setCopyState] = useState('')
  const generation = useRef(0)
  const loadSequence = useRef(0)
  const copySequence = useRef(0)
  const creatingRef = useRef(false)
  const refreshProfile = useCallback(async () => {
    const accountGeneration = generation.current
    try {
      await loadBootstrap()
      if (accountGeneration === generation.current) setProfileError('')
    } catch (error) { if (accountGeneration === generation.current) setProfileError(error.message) }
  }, [loadBootstrap])
  const load = useCallback(async () => {
    const request = ++loadSequence.current
    const accountGeneration = generation.current
    const current = () => request === loadSequence.current && accountGeneration === generation.current && useCoachingStore.getState().userId === userId
    setLoading(true)
    try {
      const result = await coachingApi('/invitations')
      if (current()) { setItems(result.items); setLoadError('') }
    } catch (error) {
      if (current()) {
        if ([401, 403, 404].includes(error.status)) setItems(null)
        setLoadError(error.message)
      }
    } finally { if (current()) setLoading(false) }
  }, [userId])
  useEffect(() => {
    generation.current += 1
    setItems(null); setShare(null); setError(''); setProfileError(''); setLoadError(''); setCopyState(''); setCreating(false); creatingRef.current = false
    refreshProfile()
    load()
    return () => { generation.current += 1; loadSequence.current += 1; copySequence.current += 1 }
  }, [refreshProfile, load])
  const create = async () => {
    if (creatingRef.current) return
    const accountGeneration = generation.current
    creatingRef.current = true; setCreating(true); setError('')
    try {
      const result = await coachingMutation('/invitations', {})
      if (accountGeneration !== generation.current || useCoachingStore.getState().userId !== userId) return
      copySequence.current += 1; setShare(result); setCopyState(''); await load()
    } catch (error) { if (accountGeneration === generation.current) setError(error.message) }
    finally { if (accountGeneration === generation.current) { creatingRef.current = false; setCreating(false) } }
  }
  const doRevoke = async id => {
    const accountGeneration = generation.current
    setError('')
    try {
      await coachingMutation('/invitations/revoke', { invitationId: id })
      if (accountGeneration !== generation.current || useCoachingStore.getState().userId !== userId) return
      if (share?.id === id) { copySequence.current += 1; setShare(null); setCopyState('') }
      await load()
    } catch (error) { if (accountGeneration === generation.current) setError(error.message) }
  }
  // Revoking permanently invalidates the link — a client holding it can no longer
  // use it to connect, so FR-013 requires confirmation before it applies.
  const revoke = id => confirmSheet({
    title: 'Revoke this invitation?',
    message: 'The link stops working immediately. Create a new invitation if this client still needs to connect.',
    confirmText: 'Revoke',
    danger: true,
    onConfirm: () => doRevoke(id)
  })
  const copy = async () => {
    const accountGeneration = generation.current
    const request = ++copySequence.current
    setCopyState('')
    try {
      await navigator.clipboard.writeText(share.shareUrl)
      if (accountGeneration === generation.current && request === copySequence.current) setCopyState('copied')
    } catch {
      if (accountGeneration === generation.current && request === copySequence.current) setCopyState('manual')
    }
  }
  return <CoachingShell mode="trainer" title="Invitations" eyebrow="Trainer Studio" action={<Button variant="primary" icon="plus" disabled={!bootstrap?.trainerProfile || creating} onClick={create}>{creating ? 'Creating…' : 'New invitation'}</Button>}>
    {bootstrap && !bootstrap.trainerProfile && <div className="coaching-banner"><div><strong>Studio profile required</strong><p>Save your trainer name and time zone before creating invitations.</p></div></div>}
    {profileError && <div className="coaching-error" role="alert"><p>{profileError}</p><div className="coaching-actions"><Button onClick={refreshProfile}>Try again</Button></div></div>}
    {error && <div className="coaching-error" role="alert">{error}</div>}
    {share && <section className="coaching-panel coaching-share"><div><span>One-time invitation link</span><strong>{share.shareUrl}</strong><small>Expires {new Date(share.expiresAt).toLocaleString()}. This link is shown only now.</small>
      {copyState === 'copied' && <p role="status">Link copied.</p>}
      {copyState === 'manual' && <div className="coaching-form"><p role="status">Copying is unavailable. Select the link below and copy it manually.</p><label><span>Invitation link</span><input readOnly value={share.shareUrl} onFocus={event => event.target.select()} /></label></div>}
    </div><div className="coaching-actions"><Button variant="primary" onClick={copy}>Copy link</Button><Button onClick={() => revoke(share.id)}>Revoke</Button></div></section>}
    <section className="coaching-panel"><div className="coaching-panel-head"><div><h2>Invitation history</h2><p>Lost links cannot be recovered. Revoke the old invitation and create a replacement.</p></div></div>
      {loadError && <div className="coaching-error" role="alert"><p>{loadError}</p>{items && <p>Showing the last loaded invitations. They may be out of date.</p>}<div className="coaching-actions"><Button disabled={loading} onClick={load}>Try again</Button></div></div>}
      {items === null ? loading ? <div className="coaching-client-list" role="status" aria-label="Loading invitations"><SkeletonRow /><SkeletonRow /></div> : <p>Invitation history is unavailable.</p> : !items.length ? <EmptyState icon="link" description="No invitations yet." /> : <div className="coaching-client-list">{items.map(item => <div className="coaching-invite-row" key={item.id}><span><StatusBadge status={item.state} label={item.state} /><small>Expires {new Date(item.expiresAt).toLocaleDateString()}</small></span>{item.state === 'pending' && <Button onClick={() => revoke(item.id)}>Revoke</Button>}</div>)}</div>}
    </section>
  </CoachingShell>
}
