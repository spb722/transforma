import { useEffect, useState } from 'react'
import { coachingApi, coachingMutation } from '../../lib/coaching/api.js'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import { Button, StatusBadge, EmptyState } from '../../components/ui.jsx'
import { confirmSheet } from '../../sheets.jsx'

export default function Invitations() {
  const bootstrap = useCoachingStore(s => s.bootstrap)
  const loadBootstrap = useCoachingStore(s => s.loadBootstrap)
  const [items, setItems] = useState([])
  const [share, setShare] = useState(null)
  const [error, setError] = useState('')
  const load = () => coachingApi('/invitations').then(x => setItems(x.items)).catch(e => setError(e.message))
  useEffect(() => { loadBootstrap().catch(() => {}); load() }, [loadBootstrap])
  const create = async () => { setError(''); try { const result = await coachingMutation('/invitations', {}); setShare(result); await load() } catch (e) { setError(e.message) } }
  const doRevoke = async id => { try { await coachingMutation('/invitations/revoke', { invitationId: id }); if (share?.id === id) setShare(null); await load() } catch (e) { setError(e.message) } }
  // Revoking permanently invalidates the link — a client holding it can no longer
  // use it to connect, so FR-013 requires confirmation before it applies.
  const revoke = id => confirmSheet({
    title: 'Revoke this invitation?',
    message: 'The link stops working immediately. Create a new invitation if this client still needs to connect.',
    confirmText: 'Revoke',
    danger: true,
    onConfirm: () => doRevoke(id)
  })
  const copy = () => navigator.clipboard.writeText(share.shareUrl)
  return <CoachingShell mode="trainer" title="Invitations" eyebrow="Trainer Studio" action={<Button variant="primary" icon="plus" disabled={!bootstrap?.trainerProfile} onClick={create}>New invitation</Button>}>
    {!bootstrap?.trainerProfile && <div className="coaching-banner"><div><strong>Studio profile required</strong><p>Save your trainer name and time zone before creating invitations.</p></div></div>}
    {error && <div className="coaching-error">{error}</div>}
    {share && <section className="coaching-panel coaching-share"><div><span>One-time invitation link</span><strong>{share.shareUrl}</strong><small>Expires {new Date(share.expiresAt).toLocaleString()}. This link is shown only now.</small></div><div className="coaching-actions"><Button variant="primary" onClick={copy}>Copy link</Button><Button onClick={() => revoke(share.id)}>Revoke</Button></div></section>}
    <section className="coaching-panel"><div className="coaching-panel-head"><div><h2>Invitation history</h2><p>Lost links cannot be recovered. Revoke the old invitation and create a replacement.</p></div></div>
      {!items.length ? <EmptyState icon="link" description="No invitations yet." /> : <div className="coaching-client-list">{items.map(item => <div className="coaching-invite-row" key={item.id}><span><StatusBadge status={item.state} label={item.state} /><small>Expires {new Date(item.expiresAt).toLocaleDateString()}</small></span>{item.state === 'pending' && <Button onClick={() => revoke(item.id)}>Revoke</Button>}</div>)}</div>}
    </section>
  </CoachingShell>
}
