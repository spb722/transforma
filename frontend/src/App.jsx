import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import { useCoachingStore } from './store/useCoachingStore.js'
import { useUI } from './store/useUI.js'
import { bindUI, OfflineBanner } from './components/ui.jsx'
import { ACCENTS } from './lib/format.js'
import { setLang, useLang } from './lib/i18n.js'
import { setNav } from './lib/nav.js'
import { useWakeLock } from './lib/wakelock.js'
import { startFlow } from './sheets.jsx'
import Icon from './components/Icon.jsx'
import TabBar from './components/TabBar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import RestTimer from './components/RestTimer.jsx'
import Login from './views/Login.jsx'
import Home from './views/Home.jsx'
import Plan from './views/Plan.jsx'
import RoutineEdit from './views/RoutineEdit.jsx'
import Workout from './views/Workout.jsx'
import Stats from './views/Stats.jsx'
import History from './views/History.jsx'
import Library from './views/Library.jsx'
import Settings from './views/Settings.jsx'
import Admin from './views/Admin.jsx'
import Coach from './views/Coach.jsx'
import CoachIntake from './views/CoachIntake.jsx'
import CoachProposal from './views/CoachProposal.jsx'
import Join from './views/coaching/Join.jsx'
import TrainerHome from './views/coaching/TrainerHome.jsx'
import ClientHome from './views/coaching/ClientHome.jsx'
import ClientWorkspace from './views/coaching/ClientWorkspace.jsx'
import TrainerSettings from './views/coaching/TrainerSettings.jsx'
import Invitations from './views/coaching/Invitations.jsx'
import WorkoutPlans from './views/coaching/WorkoutPlans.jsx'
import DietPlans from './views/coaching/DietPlans.jsx'
import MyDiet from './views/coaching/MyDiet.jsx'
import WeeklyCheckIn from './views/coaching/WeeklyCheckIn.jsx'
import Progress from './views/coaching/Progress.jsx'
import Fees from './views/coaching/Fees.jsx'
import './components/coaching/coaching.css'
import './components/coaching/editor.css'
import './components/coaching/diet.css'
import './components/coaching/checkin.css'
import './components/coaching/fees.css'
import { hasActiveCoachPlan } from './lib/coaching/schedule.js'

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

function applyPrefs(theme, accent) {
  const de = document.documentElement
  de.dataset.theme = theme === 'light' ? 'light' : 'dark'
  de.dataset.accent = ACCENTS[accent] ? accent : 'lime'
  // Kept in sync with --bg's actual values in index.css (T007/T008) — this was still
  // the pre-redesign #f2f2f7/#000000 pair, found while updating the static icon/splash
  // assets for the same palette (T073).
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = de.dataset.theme === 'light' ? '#f3f2f2' : '#201e1d'
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const { S, user, ready } = useStore()
  const ownWorkspace = useCoachingStore(s => s.ownWorkspace)
  const coachPlanActive = hasActiveCoachPlan(ownWorkspace)
  const bindCoachingUser = useCoachingStore(s => s.bindUser)
  const refreshOwnCoaching = useCoachingStore(s => s.refreshOwnCoaching)
  const startOwnRevalidation = useCoachingStore(s => s.startOwnRevalidation)
  const stopOwnRevalidation = useCoachingStore(s => s.stopOwnRevalidation)
  const isGuest = useStore(s => s.isGuest())
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  // FR-028: a clear, app-wide offline indicator. The service worker already keeps
  // previously loaded screens usable offline; this only makes that state visible.
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])
  useEffect(() => { setNav(navigate) }, [navigate])
  useEffect(() => { bindCoachingUser(user) }, [bindCoachingUser, user])
  useEffect(() => {
    if (!user) { stopOwnRevalidation(); return }
    refreshOwnCoaching().catch(() => {})
    startOwnRevalidation()
    return stopOwnRevalidation
  }, [user?.id, refreshOwnCoaching, startOwnRevalidation, stopOwnRevalidation])
  useEffect(() => { applyPrefs(S.theme, S.accent) }, [S.theme, S.accent])
  useEffect(() => { setLang(S.lang || 'en') }, [S.lang])
  useEffect(() => { document.documentElement.lang = S.lang || 'en' }, [langV, S.lang])
  // every tab/route change starts at the top of the page
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  // bound to the workout, not to the route — checking Stats mid-session keeps the screen on
  useWakeLock(!!S.active && S.keepAwake !== false)

  const authed = user || isGuest
  const joinRoute = loc.pathname.startsWith('/join/')
  if (!ready && !authed) return (
    <div id="app">
      <div style={{ paddingTop: '44vh', display: 'flex', justifyContent: 'center', fontSize: 34, color: 'var(--label-3)' }}>
        <Icon name="dumbbell" />
      </div>
    </div>
  )

  return (
    <>
      {/* keyed on the route: a view that throws is contained, and switching tabs
          re-mounts the boundary, so the tab bar is always a way out */}
      <div id="app" className="vfade" key={loc.pathname}>
        {!online && <OfflineBanner message="You're offline — showing what's already on this device. Actions that need the network will fail until you're back online." />}
        <ErrorBoundary>
          {!authed && !joinRoute ? <Login /> : (
            <Routes>
              <Route path="/join/:token" element={<Join />} />
              <Route path="/home" element={<Home />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/plan/r/:id" element={coachPlanActive ? <Navigate to="/plan" replace /> : <RoutineEdit />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/history" element={<History />} />
              <Route path="/library" element={<Library />} />
              <Route path="/settings" element={<Settings />} />
              {/* The Coach screens gate themselves on the instance config; the routes exist
                  unconditionally so a deep link from a notification lands somewhere sane
                  rather than on the catch-all. */}
              <Route path="/coach" element={coachPlanActive ? <Navigate to="/plan" replace /> : <Coach />} />
              <Route path="/coach/intake" element={coachPlanActive ? <Navigate to="/plan" replace /> : <CoachIntake />} />
              <Route path="/coach/proposal" element={coachPlanActive ? <Navigate to="/plan" replace /> : <CoachProposal />} />
              <Route path="/admin" element={user?.admin ? <Admin /> : <Navigate to="/home" replace />} />
              <Route path="/studio" element={user?.capabilities?.trainer ? <TrainerHome /> : <Navigate to="/home" replace />} />
              <Route path="/studio/clients/:relationshipId" element={user?.capabilities?.trainer ? <ClientWorkspace mode="trainer" /> : <Navigate to="/home" replace />} />
              <Route path="/studio/clients/:relationshipId/workout" element={user?.capabilities?.trainer ? <WorkoutPlans /> : <Navigate to="/home" replace />} />
              <Route path="/studio/clients/:relationshipId/diet" element={user?.capabilities?.trainer ? <DietPlans /> : <Navigate to="/home" replace />} />
              <Route path="/studio/clients/:relationshipId/check-in" element={user?.capabilities?.trainer ? <WeeklyCheckIn mode="trainer" /> : <Navigate to="/home" replace />} />
              <Route path="/studio/clients/:relationshipId/progress" element={user?.capabilities?.trainer ? <Progress mode="trainer" /> : <Navigate to="/home" replace />} />
              <Route path="/studio/clients/:relationshipId/fees" element={user?.capabilities?.trainer ? <Fees mode="trainer" /> : <Navigate to="/home" replace />} />
              <Route path="/studio/invitations" element={user?.capabilities?.trainer ? <Invitations /> : <Navigate to="/home" replace />} />
              <Route path="/studio/settings" element={user?.capabilities?.trainer ? <TrainerSettings /> : <Navigate to="/home" replace />} />
              <Route path="/coaching" element={user ? <ClientHome /> : <Navigate to="/home" replace />} />
              <Route path="/coaching/:relationshipId" element={user ? <ClientWorkspace mode="client" /> : <Navigate to="/home" replace />} />
              <Route path="/coaching/:relationshipId/diet" element={user ? <MyDiet /> : <Navigate to="/home" replace />} />
              <Route path="/coaching/:relationshipId/check-in" element={user ? <WeeklyCheckIn mode="client" /> : <Navigate to="/home" replace />} />
              <Route path="/coaching/:relationshipId/progress" element={user ? <Progress mode="client" /> : <Navigate to="/home" replace />} />
              <Route path="/coaching/:relationshipId/fees" element={user ? <Fees mode="client" /> : <Navigate to="/home" replace />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          )}
        </ErrorBoundary>
      </div>
      <TabBar onStart={startFlow} />
      <RestTimer />
      <Modals />
      <Toast />
    </>
  )
}

export default function App() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  return <HashRouter><Shell /></HashRouter>
}
