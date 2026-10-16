import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import DietPlanEditor from '../../components/coaching/DietPlanEditor.jsx'
import { newDiet, normalizeDiet } from '../../lib/coaching/diet.js'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import { coachingMutation } from '../../lib/coaching/api.js'
import { Button } from '../../components/ui.jsx'
import { confirmSheet } from '../../sheets.jsx'

export default function DietPlans() {
  const { relationshipId } = useParams()
  // Each client gets a fresh editor, including when the next client has no diet.
  return <ClientDietEditor key={relationshipId} relationshipId={relationshipId} />
}

function ClientDietEditor({ relationshipId }) {
  const nav = useNavigate()
  const { trainerWorkspace, loadTrainerWorkspace, save } = useCoachingStore()
  const workspace = trainerWorkspace?.relationship?.id === relationshipId ? trainerWorkspace : null
  const [draft, setDraft] = useState(() => workspace?.diet?.content ? structuredClone(workspace.diet.content) : newDiet())
  const [status, setStatus] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    loadTrainerWorkspace(relationshipId).catch(error => { if (active) setLoadError(error.message) })
    return () => { active = false }
  }, [relationshipId, loadTrainerWorkspace])

  useEffect(() => {
    if (workspace) setDraft(workspace.diet?.content ? structuredClone(workspace.diet.content) : newDiet())
    // A same-version workspace refresh must not erase edits already typed here.
  }, [workspace?.relationship?.id, workspace?.diet?.id, workspace?.diet?.version])

  const doPublish = async () => {
    if (!workspace) return
    setStatus('Publishing…')
    try {
      await save(() => coachingMutation('/plans/publish', {
        relationshipId, kind: 'diet', expectedVersion: workspace.diet?.version || 0, content: normalizeDiet(draft)
      }))
      await loadTrainerWorkspace(relationshipId)
      setStatus('Published')
    } catch (error) { setStatus(error.message) }
  }
  const publish = () => confirmSheet({
    title: 'Publish this diet to the client?', message: 'This replaces the diet plan the client currently sees.',
    confirmText: 'Publish', onConfirm: doPublish
  })

  return <CoachingShell mode="trainer" title="Diet plan" eyebrow={workspace?.client?.name || 'Client'} action={<Button onClick={() => nav(`/studio/clients/${relationshipId}`)}>Back</Button>}>
    <section className="coaching-panel">
      {workspace ? <>
        <DietPlanEditor value={draft} onChange={setDraft} />
        <div className="coaching-actions coaching-publish"><Button variant="primary" onClick={publish}>Publish to client</Button><span role="status">{status}</span></div>
      </> : <p role={loadError ? 'alert' : 'status'}>{loadError || 'Loading client diet…'}</p>}
    </section>
  </CoachingShell>
}
