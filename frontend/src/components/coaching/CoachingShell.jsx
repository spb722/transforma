import { NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import Icon from '../Icon.jsx'

const trainerNav = [
  ['/studio', 'house', 'Overview'],
  ['/studio/invitations', 'link', 'Invitations'],
  ['/studio/settings', 'gear', 'Studio settings']
]

export default function CoachingShell({ mode, title, eyebrow, action, children }) {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const links = mode === 'trainer' ? trainerNav : [
    ['/coaching', 'house', 'Today'],
    ['/home', 'dumbbell', 'Personal'],
    ['/settings', 'gear', 'Settings']
  ]
  return <div className="coaching-app">
    <aside className="coaching-nav" aria-label={mode === 'trainer' ? 'Trainer Studio' : 'Coaching'}>
      <button className="coaching-brand" onClick={() => nav(mode === 'trainer' ? '/studio' : '/coaching')}>
        <span className="coaching-mark"><Icon name="dumbbell" /></span>
        <span><strong>transforma</strong><small>{mode === 'trainer' ? 'Trainer Studio' : 'Coaching'}</small></span>
      </button>
      <nav>
        {links.map(([to, icon, label]) => <NavLink key={to} to={to} end={to === '/studio' || to === '/coaching'}>
          <Icon name={icon} /><span>{label}</span>
        </NavLink>)}
      </nav>
      <div className="coaching-account"><Icon name="personCircle" /><span><strong>{user?.name}</strong><small>{mode === 'trainer' ? 'Trainer account' : 'Client account'}</small></span></div>
    </aside>
    <main className="coaching-main">
      <header className="coaching-header">
        <div>{eyebrow && <p>{eyebrow}</p>}<h1>{title}</h1></div>
        {action}
      </header>
      {children}
    </main>
  </div>
}
