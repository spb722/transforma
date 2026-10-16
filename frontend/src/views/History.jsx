import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { WorkoutRow, workoutDetailSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { useCoachingStore } from '../store/useCoachingStore.js'
import { assignedOutbox } from '../lib/coaching/outbox.js'

export default function History() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const userId = useStore(s => s.user?.id)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const pending = userId ? assignedOutbox.pending(userId) : []
  const retrySync = async () => {
    setSyncing(true); setSyncError('')
    try {
      await useCoachingStore.getState().syncAssignedResults()
      await useStore.getState().pullState()
    } catch (error) { setSyncError(error.message || 'Reconnect and retry synchronization.') }
    finally { setSyncing(false) }
  }
  return <>
    <div className="hdr"><button className="iconbtn" onClick={() => nav('/stats')} aria-label={t('Stats')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 12 }}><h1>{t('History')}</h1><div className="sub">{t('{0} workouts', S.workouts.length)}</div></div></div>
    {pending.length > 0 && <section className="card" role="status">
      <strong>{t('Saved on this device, waiting to sync')}</strong>
      <p className="muted small">{pending.length} {t('assigned result(s) are waiting for a server receipt.')}</p>
      {syncError && <p role="alert" style={{ color: 'var(--red)' }}>{syncError}</p>}
      <Button onClick={retrySync} disabled={syncing}>{syncing ? t('Syncing…') : t('Retry sync')}</Button>
    </section>}
    {S.workouts.length ? <div className="list">{[...S.workouts].reverse().map(w => <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />)}</div>
      : <div className="empty"><div className="ico"><Icon name="history" /></div>{t('No workouts yet.')}</div>}
  </>
}
