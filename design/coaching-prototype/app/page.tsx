'use client';
import {
  useState,
  type CSSProperties,
  type ReactNode,
  type FormEvent,
} from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  Dumbbell,
  Flame,
  LayoutDashboard,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Sprout,
  Target,
  TrendingUp,
  Users,
  Wallet,
  CalendarDays,
  RotateCcw,
  Play,
  CheckCircle2,
  ExternalLink,
  LockKeyhole,
  Utensils,
  Send,
  X,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Toaster, toast as toastManager } from '@/components/ui/toast';
const toast = Object.assign(
  (title: string) => toastManager.add({ title, type: 'info' }),
  {
    success: (title: string) => toastManager.add({ title, type: 'success' }),
    error: (title: string) => toastManager.add({ title, type: 'error' }),
  },
);
import {
  initialClients,
  workoutTemplates,
  dietTemplates,
  money,
  isOverdue,
  stateLabel,
  type Client,
} from './studio-data';

type Modal =
  | 'invite'
  | 'workout'
  | 'diet'
  | 'checkin'
  | 'payment'
  | 'paid'
  | 'newfee'
  | 'contact'
  | 'reset'
  | 'correction'
  | null;
type LoggedSet = { weight: number; reps: number; done: boolean };
function Avatar({
  person,
  large = false,
}: {
  person: Client;
  large?: boolean;
}) {
  return (
    <span className={`avatar ${person.color} ${large ? 'large' : ''}`}>
      {person.initials}
    </span>
  );
}
function Person({
  person,
  description,
}: {
  person: Client;
  description?: string;
}) {
  return (
    <div className="person">
      <Avatar person={person} />
      <div>
        <strong>{person.name}</strong>
        <small>{description ?? person.goal}</small>
      </div>
    </div>
  );
}
function Tag({
  children,
  tone = 'green',
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`status ${tone}`}>{children}</span>;
}
function StudioNav({
  nav,
  onNav,
  pending,
  role,
}: {
  nav: string;
  onNav: (n: string) => void;
  pending: number;
  role: string;
}) {
  const { setOpenMobile } = useSidebar();
  const items =
    role === 'trainer'
      ? [
          [LayoutDashboard, 'Overview'],
          [Users, 'Clients'],
          [Dumbbell, 'Workouts'],
          [Sprout, 'Diets'],
          [ClipboardCheck, 'Check-ins'],
          [Wallet, 'Fees'],
        ]
      : [
          [LayoutDashboard, 'Today'],
          [Dumbbell, 'My workouts'],
          [Sprout, 'My diet'],
          [TrendingUp, 'My progress'],
          [Wallet, 'My fees'],
        ];
  return (
    <SidebarMenu>
      {items.map(([Icon, label]: any) => (
        <SidebarMenuItem key={label}>
          <SidebarMenuButton
            className="nav-button"
            isActive={nav === label}
            onClick={() => {
              onNav(label);
              setOpenMobile(false);
            }}
          >
            <Icon size={19} />
            <span>{label}</span>
            {label === 'Check-ins' && pending > 0 && (
              <span className="nav-count">{pending}</span>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
function WeightChart({ client }: { client: Client }) {
  const start = Number(client.startWeight),
    end = Number(client.weight),
    delta = end - start;
  const values = [
    start,
    start + delta * 0.28,
    start + delta * 0.42,
    start + delta * 0.4,
    start + delta * 0.72,
    end,
  ];
  const min = Math.min(...values) - 0.4,
    max = Math.max(...values) + 0.4;
  const ys = values.map((n) => 150 - ((n - min) / (max - min)) * 115);
  const points = ys.map((y, i) => `${48 + i * 73},${y}`).join(' ');
  return (
    <div className="weight-chart">
      <svg
        viewBox="0 0 450 190"
        role="img"
        aria-label={`Weight trend from ${start} to ${end} kilograms over six weeks`}
      >
        <title>Body weight, kilograms</title>
        {[min, (min + max) / 2, max].map((n, i) => (
          <g key={i}>
            <line
              x1="46"
              x2="417"
              y1={150 - i * 57.5}
              y2={150 - i * 57.5}
              stroke="#e5ece6"
            />
            <text x="0" y={154 - i * 57.5}>
              {n.toFixed(1)}
            </text>
          </g>
        ))}
        <polygon points={`48,150 ${points} 413,150`} fill="#edf5e6" />
        <polyline
          points={points}
          fill="none"
          stroke="#639749"
          strokeWidth="2.5"
        />
        {ys.map((y, i) => (
          <g key={i}>
            <circle
              cx={48 + i * 73}
              cy={y}
              r="4"
              fill="#639749"
              stroke="white"
              strokeWidth="2"
            />
            <text
              className={
                i === 0 || i === 2 || i === 5
                  ? 'chart-tick-major'
                  : 'chart-tick-minor'
              }
              x={48 + i * 73}
              y="181"
              textAnchor="middle"
            >
              {['3 Aug', '10 Aug', '17 Aug', '24 Aug', '31 Aug', '7 Sep'][i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
export default function Home() {
  const [clients, setClients] = useState<Client[]>(
    initialClients.map((c) => ({
      ...c,
      paymentHistory: [...c.paymentHistory],
    })),
  );
  const [role, setRole] = useState('trainer');
  const [nav, setNav] = useState('Overview');
  const [selected, setSelected] = useState('aarav');
  const [detail, setDetail] = useState(false);
  const [tab, setTab] = useState('workouts');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState<Modal>(null);
  const [template, setTemplate] = useState(0);
  const [planNote, setPlanNote] = useState(
    'Focus on controlled reps. We will build up gradually.',
  );
  const [customNotes, setCustomNotes] = useState<Record<string, string>>({});
  const [dietNotes, setDietNotes] = useState<Record<string, string>>({});
  const [response, setResponse] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteCreated, setInviteCreated] = useState(false);
  const [newClientId, setNewClientId] = useState('');
  const [checkWeight, setCheckWeight] = useState('');
  const [checkAdherence, setCheckAdherence] = useState('Mostly');
  const [checkNote, setCheckNote] = useState('');
  const [sets, setSets] = useState<LoggedSet[]>([]);
  const [training, setTraining] = useState(false);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [confirmReceipt, setConfirmReceipt] = useState(false);
  const [feeAmount, setFeeAmount] = useState('6000');
  const [feeDate, setFeeDate] = useState('2026-09-10');
  const [feeLink, setFeeLink] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [sessionLogs, setSessionLogs] = useState<
    Record<string, { title: string; sets: LoggedSet[]; targets: string[] }[]>
  >({});
  const client = clients.find((c) => c.id === selected) ?? clients[0];
  const pending = clients.filter((c) => c.checkedIn && !c.response);
  const active = clients.filter((c) => c.total > 0);
  const totalCompleted = active.reduce((a, c) => a + c.completed, 0),
    totalPlanned = active.reduce((a, c) => a + c.total, 0);
  const currentPlan =
    workoutTemplates.find((p) => p.name === client.plan) ?? workoutTemplates[0];
  const currentDiet =
    dietTemplates.find((p) => p.name === client.diet) ?? dietTemplates[0];
  const updateClient = (patch: Partial<Client>, id = selected) =>
    setClients((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const go = (n: string) => {
    setNav(n);
    setDetail(false);
    setSearch('');
    setFilter('all');
    setTraining(false);
  };
  const switchRole = (r: string) => {
    setRole(r);
    setNav(r === 'trainer' ? 'Overview' : 'Today');
    setDetail(false);
    setTraining(false);
  };
  const openClient = (id: string, t = 'workouts') => {
    setSelected(id);
    setDetail(true);
    setTab(t);
    setNav('Clients');
    setResponse('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const openAssignment = (kind: 'workout' | 'diet', index = 0) => {
    setTemplate(index);
    setPlanNote(
      kind === 'workout'
        ? (customNotes[selected] ??
            'Focus on controlled reps. We will build up gradually.')
        : (dietNotes[selected] ??
            'These portions are a starting point. Let me know how your energy and hunger feel.'),
    );
    setModal(kind);
  };
  const openCheckin = () => {
    setCheckWeight(client.weight);
    setCheckAdherence(client.adherence);
    setCheckNote(client.note);
    setModal('checkin');
  };
  const startWorkout = () => {
    if (sessionLogs[selected]?.length) {
      go('My progress');
      toast('Today’s workout is already saved. Here are your results.');
      return;
    }
    setSets(
      currentPlan.exercises.flatMap((e) =>
        Array.from({ length: e.sets }, () => ({
          weight: e.weight,
          reps: e.reps,
          done: false,
        })),
      ),
    );
    setSessionFinished(false);
    setTraining(true);
    setNav('Today');
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy is unavailable. Select and copy the link below.');
    }
  };
  function assign(e: FormEvent) {
    e.preventDefault();
    updateClient(
      modal === 'workout'
        ? {
            plan: workoutTemplates[template].name,
            total: workoutTemplates[template].days,
          }
        : { diet: dietTemplates[template].name },
    );
    if (modal === 'workout')
      setCustomNotes((n) => ({ ...n, [selected]: planNote }));
    else setDietNotes((n) => ({ ...n, [selected]: planNote }));
    toast.success(
      `${modal === 'workout' ? 'Workout' : 'Diet'} plan assigned to ${client.name.split(' ')[0]}`,
    );
    setModal(null);
  }
  function submitCheckin(e: FormEvent) {
    e.preventDefault();
    updateClient({
      weight: checkWeight || client.weight,
      note: checkNote,
      adherence: checkAdherence,
      checkedIn: true,
      response: '',
    });
    setModal(null);
    toast.success('Check-in shared with Sachin');
  }
  function createInvite(e: FormEvent) {
    e.preventDefault();
    setInviteCreated(true);
    setNewClientId('client-' + Date.now());
  }
  function joinInvite() {
    const name = inviteName.trim();
    const c: Client = {
      id: newClientId,
      name,
      initials: name
        .split(/\s+/)
        .map((x) => x[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
      goal: 'Set a goal with your trainer',
      completed: 0,
      total: 0,
      weight: '',
      startWeight: '',
      status: 'Getting started',
      tone: 'green',
      color: 'mint',
      plan: '',
      diet: '',
      fee: 0,
      paid: false,
      due: '2026-09-10',
      note: '',
      adherence: 'Not applicable',
      response: '',
      checkedIn: false,
      paymentHistory: [],
      joined: true,
    };
    setClients((cs) => [...cs, c]);
    setSelected(c.id);
    switchRole('client');
    setModal(null);
    toast.success(
      `Welcome, ${name.split(' ')[0]}. You are connected to Sachin.`,
    );
  }
  const heading = (
    eyebrow: string,
    title: ReactNode,
    sub: string,
    action?: ReactNode,
  ) => (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtitle">{sub}</p>
      </div>
      {action}
    </div>
  );
  const inviteButton = (
    <Button
      className="primary"
      onClick={() => {
        setInviteName('');
        setInviteCreated(false);
        setModal('invite');
      }}
    >
      <Plus size={18} />
      Invite client
    </Button>
  );
  function ClientTable() {
    const shown = clients
      .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      .filter(
        (c) =>
          filter === 'all' ||
          (filter === 'attention' &&
            (stateLabel(c) !== 'On track' || isOverdue(c))),
      );
    return (
      <section className="panel client-panel">
        <div className="section-heading">
          <div>
            <h2>
              Your clients <span className="count">{clients.length}</span>
            </h2>
            <p>A little attention goes a long way.</p>
          </div>
          {nav === 'Overview' && (
            <Button
              variant="ghost"
              className="text-button"
              onClick={() => go('Clients')}
            >
              View all <ArrowRight size={16} />
            </Button>
          )}
        </div>
        <div className="search-wrap">
          <Search size={17} />
          <Input
            placeholder="Find a client…"
            aria-label="Find a client"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {nav === 'Clients' && (
          <div className="filter-row">
            <Button
              variant={filter === 'all' ? 'secondary' : 'ghost'}
              onClick={() => setFilter('all')}
            >
              All clients
            </Button>
            <Button
              variant={filter === 'attention' ? 'secondary' : 'ghost'}
              onClick={() => setFilter('attention')}
            >
              Needs attention
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CLIENT</TableHead>
              <TableHead>THIS WEEK</TableHead>
              <TableHead>STATUS</TableHead>
              <TableHead>
                <span className="sr-only">Open client</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <button
                    className="person-link"
                    onClick={() => openClient(c.id)}
                  >
                    <Person person={c} />
                  </button>
                </TableCell>
                <TableCell>
                  <div className="mini-progress">
                    {Array.from({ length: c.total }, (_, i) => (
                      <span key={i} className={i < c.completed ? 'done' : ''} />
                    ))}
                  </div>
                  <small>
                    {c.total
                      ? `${c.completed} of ${c.total} sessions`
                      : 'Plan not assigned'}
                  </small>
                </TableCell>
                <TableCell>
                  <Tag tone={stateLabel(c) === 'On track' ? 'green' : 'orange'}>
                    {stateLabel(c) === 'On track' && <Check size={12} />}{' '}
                    {c.joined ? 'Getting started' : stateLabel(c)}
                  </Tag>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Open ${c.name}`}
                    onClick={() => openClient(c.id)}
                  >
                    <ArrowUpRight size={18} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!shown.length && (
          <div className="empty-state">
            <Search />
            <h3>No matching clients</h3>
            <p>Try a different name or clear the filter.</p>
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setFilter('all');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </section>
    );
  }
  function Dashboard() {
    return (
      <>
        {heading(
          'YOUR WEEK, AT A GLANCE',
          <>
            Let’s make progress<span className="green-dot">.</span>
          </>,
          `${clients.length} people. Different goals. One stronger week ahead.`,
          inviteButton,
        )}
        <section className="metrics">
          <div className="metric">
            <span>
              Active clients <Users size={18} />
            </span>
            <strong>{String(clients.length).padStart(2, '0')}</strong>
            <small>Your coaching community</small>
          </div>
          <div className="metric">
            <span>
              Sessions this week <Dumbbell size={18} />
            </span>
            <strong>
              {totalCompleted}
              <span className="metric-denom"> / {totalPlanned}</span>
            </strong>
            <small>
              <span className="positive">
                {Math.round((totalCompleted / totalPlanned) * 100)}% complete
              </span>{' '}
              · {Math.max(0, totalPlanned - totalCompleted)} to go
            </small>
          </div>
          <div className="metric">
            <span>
              Check-ins to review <ClipboardCheck size={18} />
            </span>
            <strong>{String(pending.length).padStart(2, '0')}</strong>
            <small>
              {pending.length
                ? 'Your next coaching conversations'
                : 'All caught up. Nice work.'}
            </small>
          </div>
          <div className="metric">
            <span>
              Fees collected <Wallet size={18} />
            </span>
            <strong>
              {money(
                clients.filter((c) => c.paid).reduce((a, c) => a + c.fee, 0),
              )}
            </strong>
            <small>
              <span className="positive">
                {clients.filter((c) => c.paid).length} of{' '}
                {clients.filter((c) => c.fee).length} paid
              </span>{' '}
              · September
            </small>
          </div>
        </section>
        <div className="dashboard-grid">
          {ClientTable()}
          <aside className="right-rail">
            <section className="attention-card">
              <div className="section-heading">
                <h2>A moment of your time</h2>
                <span className="attention-dot" />
              </div>
              <p className="attention-intro">
                {pending.length
                  ? `${pending.length} check-ins ready for your eyes.`
                  : 'You’re up to date with your clients.'}
              </p>
              {pending.slice(0, 2).map((c, i) => (
                <div className="attention-person" key={c.id}>
                  <Person
                    person={c}
                    description={i ? '45 minutes ago' : '20 minutes ago'}
                  />
                  <p>“{c.note}”</p>
                  <Button
                    variant="outline"
                    className="review-button"
                    onClick={() => openClient(c.id, 'progress')}
                  >
                    Review check-in <ArrowUpRight size={16} />
                  </Button>
                </div>
              ))}
              {!pending.length && <CheckCircle2 className="caught-up" />}
            </section>
            <section className="week-card">
              <div className="section-heading">
                <h2>Showing up adds up.</h2>
                <TrendingUp size={19} />
              </div>
              <p>Completed sessions · last 6 weeks</p>
              <div
                className="week-bars"
                role="img"
                aria-label={`Weekly completed sessions: 9, 12, 10, 14, 13, ${totalCompleted}`}
              >
                {[9, 12, 10, 14, 13, totalCompleted].map((n, i) => (
                  <div key={i}>
                    <span
                      className={i === 5 ? 'current' : ''}
                      style={{
                        height: `${(n / Math.max(16, totalCompleted)) * 85}px`,
                      }}
                    >
                      <b>{n}</b>
                    </span>
                    <small>
                      {
                        [
                          '3 Aug',
                          '10 Aug',
                          '17 Aug',
                          '24 Aug',
                          '31 Aug',
                          '7 Sep',
                        ][i]
                      }
                    </small>
                  </div>
                ))}
              </div>
              <div className="week-foot">
                <span>
                  <ArrowUpRight size={14} />
                  {Math.round((totalCompleted / 13 - 1) * 100)}% vs. last week
                </span>
                <small>Consistency, in motion.</small>
              </div>
            </section>
          </aside>
        </div>
      </>
    );
  }
  function WorkoutPanel() {
    return (
      <>
        {!client.plan ? (
          <Empty
            icon={<Dumbbell />}
            title="A fresh start"
            text="Your trainer hasn't assigned a workout plan yet."
            action={
              role === 'trainer' ? (
                <Button
                  className="primary"
                  onClick={() => openAssignment('workout')}
                >
                  Assign workout plan
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setModal('contact')}>
                  Contact trainer
                </Button>
              )
            }
          />
        ) : (
          <>
            <section className="plan-hero">
              <div>
                <span className="plan-label">
                  <Dumbbell size={15} /> YOUR TRAINING PLAN
                </span>
                <h2>{client.plan}</h2>
                <p>{currentPlan.days} days a week · Strength & consistency</p>
                <div className="plan-meta">
                  <span>
                    <CalendarDays size={15} />
                    Week of 7 September
                  </span>
                  <span>
                    <Clock3 size={15} />
                    45–55 min / session
                  </span>
                </div>
              </div>
              {role === 'trainer' ? (
                <Button
                  className="light-button"
                  onClick={() =>
                    openAssignment(
                      'workout',
                      workoutTemplates.indexOf(currentPlan),
                    )
                  }
                >
                  Edit assignment <ArrowUpRight size={16} />
                </Button>
              ) : (
                <Button className="primary" onClick={startWorkout}>
                  <Play size={16} />
                  {sessionLogs[selected]?.length
                    ? 'View completed workout'
                    : 'Start workout'}
                </Button>
              )}
            </section>
            {WeekSchedule()}
            <div className="section-heading exercise-heading">
              <div>
                <p className="eyebrow">MONDAY · SESSION 01</p>
                <h2>
                  {currentPlan.days === 4 ? 'Upper body A' : 'Full body A'}
                </h2>
              </div>
              <Tag>4 exercises</Tag>
            </div>
            <section className="panel exercise-list">
              {currentPlan.exercises.map((e, i) => (
                <div className="exercise-row" key={e.name}>
                  <span className="exercise-number">0{i + 1}</span>
                  <div className="exercise-info">
                    <h3>{e.name}</h3>
                    <p>{e.note}</p>
                  </div>
                  <div className="prescription">
                    <strong>
                      {e.sets} × {e.reps}
                    </strong>
                    <small>{e.weight} kg · 90 sec rest</small>
                  </div>
                </div>
              ))}
            </section>
            <div className="coach-note">
              <MessageCircle size={19} />
              <div>
                <strong>A note from Sachin</strong>
                <p>
                  {customNotes[selected] ??
                    'Focus on controlled reps. We will build up gradually. If something feels uncomfortable, stop and let me know.'}
                </p>
              </div>
            </div>
          </>
        )}
      </>
    );
  }
  function WeekSchedule() {
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const scheduled = currentPlan.days === 4 ? [0, 1, 3, 5] : [0, 2, 4];
    return (
      <div className="schedule-strip" aria-label="Weekly workout schedule">
        {days.map((d, i) => (
          <div
            key={d}
            className={`schedule-day ${i === 0 ? 'today' : ''} ${scheduled.includes(i) ? 'scheduled' : ''}`}
          >
            <small>{d}</small>
            <strong>{7 + i}</strong>
            <span>
              {i === 0 ? 'Today' : scheduled.includes(i) ? 'Train' : 'Rest'}
            </span>
          </div>
        ))}
      </div>
    );
  }
  function DietPanel() {
    return (
      <>
        {!client.diet ? (
          <Empty
            icon={<Sprout />}
            title="Good food. A plan that fits."
            text="Your trainer hasn't assigned a diet yet."
            action={
              role === 'trainer' ? (
                <Button
                  className="primary"
                  onClick={() => openAssignment('diet')}
                >
                  Assign diet plan
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setModal('contact')}>
                  Contact trainer
                </Button>
              )
            }
          />
        ) : (
          <>
            <section className="diet-heading">
              <div>
                <p className="eyebrow">YOUR DAILY MEAL PLAN</p>
                <h2>{client.diet}</h2>
                <p>Familiar foods. Simple portions. Room for real life.</p>
              </div>
              <span className="diet-symbol">
                <Sprout size={40} />
              </span>
            </section>
            {role === 'trainer' && (
              <div className="inline-actions">
                <span>Assigned by Sachin · Updated 7 Sep</span>
                <Button
                  variant="outline"
                  onClick={() =>
                    openAssignment('diet', dietTemplates.indexOf(currentDiet))
                  }
                >
                  Edit diet <ArrowUpRight size={15} />
                </Button>
              </div>
            )}
            <div className="meal-grid">
              {currentDiet.meals.map((meal, i) => (
                <section className="panel meal-card" key={meal.time}>
                  <div className="section-heading">
                    <span className="meal-time">
                      0{i + 1} / {meal.time}
                    </span>
                    <Utensils size={18} />
                  </div>
                  <h3>{meal.name}</h3>
                  <p className="portion">{meal.portion}</p>
                  <p className="meal-note">{meal.note}</p>
                </section>
              ))}
            </div>
            <div className="coach-note">
              <MessageCircle size={19} />
              <div>
                <strong>A note from Sachin</strong>
                <p>
                  {dietNotes[selected] ??
                    'These portions are a starting point. Let me know how your energy and hunger feel in your weekly check-in.'}
                </p>
              </div>
            </div>
            <div className="quiet-note">
              <ClipboardCheck size={16} />
              Diet adherence comes from your weekly check-in, not from opening
              this plan.
            </div>
          </>
        )}
      </>
    );
  }
  function ProgressPanel() {
    return (
      <>
        <div className="progress-summary">
          <section className="panel progress-stat">
            <span>THIS WEEK</span>
            <h2>
              {client.completed}
              <small> / {client.total} sessions</small>
            </h2>
            <Progress
              value={client.total ? (client.completed / client.total) * 100 : 0}
              className="studio-progress"
            />
            <p>Showing up is the first win.</p>
          </section>
          <section className="panel progress-stat">
            <span>CURRENT WEIGHT</span>
            <h2>
              {client.weight || '—'} <small>kg</small>
            </h2>
            <p>
              {client.weight && client.startWeight
                ? `${Math.abs(Number(client.weight) - Number(client.startWeight)).toFixed(1)} kg ${Number(client.weight) < Number(client.startWeight) ? 'down' : 'up'} over 6 weeks`
                : 'Add a weigh-in to see your trend.'}
            </p>
          </section>
        </div>
        {client.weight && client.startWeight && (
          <section className="panel chart-panel">
            <div className="section-heading">
              <div>
                <h2>The bigger picture</h2>
                <p>Body weight · kg · last 6 weeks</p>
              </div>
              <Tag>6 weigh-ins</Tag>
            </div>
            <WeightChart client={client} />
          </section>
        )}
        <section className="panel history-panel">
          <div className="section-heading">
            <div>
              <h2>Work put in</h2>
              <p>Recent workouts · actual performance</p>
            </div>
            <Dumbbell size={20} />
          </div>
          {sessionLogs[selected]?.map((log, i) => (
            <div className="session-history" key={i}>
              <div className="section-heading">
                <strong>{log.title}</strong>
                <Tag>Today · saved</Tag>
              </div>
              <p>
                {log.sets.filter((s) => s.done).length} sets ·{' '}
                {log.sets.filter((s) => s.done).reduce((n, s) => n + s.reps, 0)}{' '}
                reps ·{' '}
                {money(
                  log.sets
                    .filter((s) => s.done)
                    .reduce((n, s) => n + s.reps * s.weight, 0),
                ).replace('₹', '')}{' '}
                kg volume
              </p>
              <details>
                <summary>View assigned targets and logged sets</summary>
                {log.targets.map((t, j) => (
                  <div key={t}>
                    <strong>{t}</strong>
                    <p>
                      {log.sets
                        .slice(j * 3, j * 3 + 3)
                        .map(
                          (set, k) =>
                            `Set ${k + 1}: ${set.done ? `${set.weight} kg × ${set.reps}` : 'not completed'}`,
                        )
                        .join(' · ')}
                    </p>
                  </div>
                ))}
              </details>
            </div>
          ))}
          {client.joined && !sessionLogs[selected]?.length ? (
            <p className="history-empty">
              Complete your first workout to start your history.
            </p>
          ) : (
            !client.joined && (
              <>
                <div className="session-history">
                  <div className="section-heading">
                    <strong>
                      {currentPlan.days === 4 ? 'Upper body B' : 'Full body B'}
                    </strong>
                    <small>5 Sep</small>
                  </div>
                  <p>12 sets · 126 reps · 3,240 kg volume</p>
                </div>
                <div className="session-history">
                  <div className="section-heading">
                    <strong>
                      {currentPlan.days === 4 ? 'Lower body A' : 'Full body A'}
                    </strong>
                    <small>3 Sep</small>
                  </div>
                  <p>12 sets · 120 reps · 3,600 kg volume</p>
                </div>
              </>
            )
          )}
        </section>
        <section className="panel checkin-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">7–13 SEPTEMBER</p>
              <h2>Weekly check-in</h2>
            </div>
            <Tag
              tone={
                client.checkedIn
                  ? client.response
                    ? 'green'
                    : 'orange'
                  : 'neutral'
              }
            >
              {client.checkedIn
                ? client.response
                  ? 'Reviewed'
                  : 'Ready for review'
                : 'Not submitted'}
            </Tag>
          </div>
          {client.checkedIn ? (
            <>
              <div className="checkin-facts">
                <div>
                  <small>Diet adherence</small>
                  <strong>{client.adherence}</strong>
                </div>
                <div>
                  <small>Current weight</small>
                  <strong>
                    {client.weight ? client.weight + ' kg' : 'Not shared'}
                  </strong>
                </div>
              </div>
              <blockquote>
                {client.note || 'No additional notes this week.'}
              </blockquote>
              {client.response && (
                <div className="response-card">
                  <span className="avatar coach small-avatar">SP</span>
                  <div>
                    <strong>Sachin’s response</strong>
                    <p>{client.response}</p>
                    <small>
                      7 Sep · Shared with {client.name.split(' ')[0]}
                    </small>
                  </div>
                </div>
              )}
              {role === 'trainer' ? (
                <form
                  className="response-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = response.trim();
                    if (!text) return;
                    updateClient({ response: text });
                    setResponse('');
                    toast.success(
                      'Response shared with ' + client.name.split(' ')[0],
                    );
                  }}
                >
                  <label htmlFor="trainer-response">
                    {client.response
                      ? 'Update your response'
                      : 'A few words can make a difference'}
                  </label>
                  <Textarea
                    id="trainer-response"
                    required
                    value={response}
                    placeholder={
                      client.response
                        ? 'Write a replacement response…'
                        : 'Encourage, guide, or suggest a small adjustment…'
                    }
                    onChange={(e) => setResponse(e.target.value)}
                  />
                  <Button
                    type="submit"
                    className="primary"
                    disabled={!response.trim()}
                  >
                    <Send size={15} />
                    {client.response ? 'Update response' : 'Share response'}
                  </Button>
                </form>
              ) : (
                <Button variant="outline" onClick={openCheckin}>
                  Update check-in
                </Button>
              )}
            </>
          ) : (
            <Empty
              icon={<ClipboardCheck />}
              title="A small pause to reflect"
              text={
                role === 'trainer'
                  ? `${client.name.split(' ')[0]} hasn't checked in this week.`
                  : 'Tell Sachin how your week is going.'
              }
              action={
                role === 'client' ? (
                  <Button className="primary" onClick={openCheckin}>
                    Complete check-in
                  </Button>
                ) : undefined
              }
            />
          )}
        </section>
      </>
    );
  }
  function FeePanel() {
    return (
      <>
        {client.fee > 0 ? (
          <section className="panel fee-card">
            <div className="section-heading">
              <span className="eyebrow">SEPTEMBER COACHING</span>
              <Tag
                tone={
                  client.paid
                    ? 'green'
                    : isOverdue(client)
                      ? 'orange'
                      : 'neutral'
                }
              >
                {client.paid ? (
                  <>
                    <Check size={14} />
                    Paid
                  </>
                ) : isOverdue(client) ? (
                  'Overdue'
                ) : (
                  'Awaiting payment'
                )}
              </Tag>
            </div>
            <h2>{money(client.fee)}</h2>
            <p>Personal training & nutrition coaching</p>
            <dl>
              <div>
                <dt>Coaching period</dt>
                <dd>1–30 September 2026</dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>
                  {new Date(client.due + 'T12:00:00').toLocaleDateString(
                    'en-GB',
                    { day: 'numeric', month: 'long', year: 'numeric' },
                  )}
                </dd>
              </div>
              <div>
                <dt>Trainer</dt>
                <dd>Sachin</dd>
              </div>
            </dl>
            {!client.paid ? (
              <Button
                className="primary"
                onClick={() => {
                  setConfirmReceipt(false);
                  setModal(role === 'trainer' ? 'paid' : 'payment');
                }}
              >
                {role === 'trainer' ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <ExternalLink size={18} />
                )}{' '}
                {role === 'trainer' ? 'Confirm payment received' : 'Pay now'}
              </Button>
            ) : (
              <div className="paid-note">
                <CheckCircle2 size={19} />
                Payment confirmed by Sachin.
              </div>
            )}
            {role === 'trainer' && client.paid && (
              <Button
                variant="ghost"
                className="text-button"
                onClick={() => {
                  setCorrectionReason('');
                  setModal('correction');
                }}
              >
                Correct payment status
              </Button>
            )}
            <div className="fee-history">
              {client.paymentHistory.map((h, i) => (
                <small key={i}>{h}</small>
              ))}
            </div>
          </section>
        ) : (
          <Empty
            icon={<Wallet />}
            title="No fees yet"
            text="New coaching fees will appear here."
            action={
              role === 'trainer' ? (
                <Button className="primary" onClick={() => setModal('newfee')}>
                  Add fee
                </Button>
              ) : undefined
            }
          />
        )}
        <div className="quiet-note">
          <LockKeyhole size={17} />
          {role === 'trainer'
            ? 'Confirm receipt only after checking your payment account.'
            : 'Payments take place outside transforma. Your trainer confirms receipt.'}
        </div>
        {role === 'trainer' && client.fee > 0 && !client.paid && (
          <Button
            variant="outline"
            onClick={() => {
              setFeeAmount(String(client.fee));
              setFeeDate(client.due);
              setModal('newfee');
            }}
          >
            Edit fee details
          </Button>
        )}
      </>
    );
  }
  function ClientDetail() {
    return (
      <>
        <button className="back-link" onClick={() => go('Clients')}>
          <ArrowLeft size={15} />
          All clients
        </button>
        <div className="client-heading">
          <div className="person">
            <Avatar person={client} large />
            <div>
              <p className="eyebrow">CLIENT WORKSPACE</p>
              <h1>{client.name}</h1>
              <p className="subtitle">
                {client.goal} ·{' '}
                {client.joined ? 'Just joined' : 'Member since August 2026'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="secondary"
            onClick={() => switchRole('client')}
          >
            Preview client view <ArrowUpRight size={16} />
          </Button>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList variant="line" className="workspace-tabs">
            {[
              ['workouts', Dumbbell, 'Workouts'],
              ['diet', Sprout, 'Diet'],
              ['progress', TrendingUp, 'Progress'],
              ['fees', Wallet, 'Fees'],
            ].map(([value, Icon, label]: any) => (
              <TabsTrigger key={value} value={value}>
                <Icon size={16} />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="workouts">{WorkoutPanel()}</TabsContent>
          <TabsContent value="diet">{DietPanel()}</TabsContent>
          <TabsContent value="progress">{ProgressPanel()}</TabsContent>
          <TabsContent value="fees">{FeePanel()}</TabsContent>
        </Tabs>
      </>
    );
  }
  function Templates({ kind }: { kind: 'workout' | 'diet' }) {
    const list = kind === 'workout' ? workoutTemplates : dietTemplates;
    return (
      <>
        {heading(
          'YOUR COACHING TOOLKIT',
          kind === 'workout'
            ? 'A strong starting point.'
            : 'Good habits start here.',
          kind === 'workout'
            ? 'Reusable plans. Personal attention for every client.'
            : 'Simple meal plans you can tailor to real lives.',
        )}
        <div className="template-grid">
          {list.map((p, i) => (
            <section
              className={`panel template-card ${kind === 'diet' ? 'food-template' : ''}`}
              key={p.name}
            >
              <div className="template-icon">
                {kind === 'workout' ? (
                  <Dumbbell size={28} />
                ) : (
                  <Sprout size={28} />
                )}
              </div>
              <p className="eyebrow">{p.tag}</p>
              <h2>{p.name}</h2>
              <p>{p.description}</p>
              <div className="template-meta">
                {kind === 'workout'
                  ? `${workoutTemplates[i].days} days / week · 4 exercises / session`
                  : '4 meals · Flexible portions'}
              </div>
              <Button
                className="primary"
                onClick={() => openAssignment(kind, i)}
              >
                Assign to a client <ArrowUpRight size={16} />
              </Button>
            </section>
          ))}
        </div>
        <p className="quiet-note">
          <Copy size={17} />
          Each assignment is a separate copy. Changes apply only to the selected
          client.
        </p>
      </>
    );
  }
  function Checkins() {
    return (
      <>
        {heading(
          'A LITTLE GUIDANCE GOES A LONG WAY',
          'Their week, in their words.',
          'Review check-ins and help each client take their next step.',
        )}
        <div className="checkin-grid">
          {clients.map((c) => (
            <section className="panel review-card" key={c.id}>
              <div className="section-heading">
                <Person person={c} />
                <Tag
                  tone={
                    !c.checkedIn ? 'neutral' : c.response ? 'green' : 'orange'
                  }
                >
                  {!c.checkedIn
                    ? 'Not submitted'
                    : c.response
                      ? 'Reviewed'
                      : 'To review'}
                </Tag>
              </div>
              <p>
                {c.checkedIn
                  ? `“${c.note || 'No extra notes this week.'}”`
                  : 'Waiting for this week’s check-in.'}
              </p>
              <Button
                variant="outline"
                onClick={() => openClient(c.id, 'progress')}
              >
                {c.response ? 'View check-in' : 'Open check-in'}
                <ArrowUpRight size={16} />
              </Button>
            </section>
          ))}
        </div>
      </>
    );
  }
  function Fees() {
    const unpaid = clients.filter((c) => !c.paid && c.fee);
    return (
      <>
        {heading(
          'COACHING, TAKEN CARE OF',
          'A clear view of your fees.',
          'September 2026 · Payments confirmed manually by you.',
        )}
        <div className="fee-summary">
          <div>
            <small>Collected</small>
            <strong>
              {money(
                clients.filter((c) => c.paid).reduce((a, c) => a + c.fee, 0),
              )}
            </strong>
          </div>
          <div>
            <small>Outstanding</small>
            <strong>{money(unpaid.reduce((a, c) => a + c.fee, 0))}</strong>
          </div>
          <div>
            <small>Overdue</small>
            <strong>
              {unpaid.filter(isOverdue).length}
              <span>
                {' '}
                client{unpaid.filter(isOverdue).length === 1 ? '' : 's'}
              </span>
            </strong>
          </div>
        </div>
        <section className="panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CLIENT</TableHead>
                <TableHead>AMOUNT</TableHead>
                <TableHead>STATUS</TableHead>
                <TableHead>ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients
                .filter((c) => c.fee)
                .map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <button
                        className="person-link"
                        onClick={() => openClient(c.id, 'fees')}
                      >
                        <Person person={c} description="September coaching" />
                      </button>
                    </TableCell>
                    <TableCell>{money(c.fee)}</TableCell>
                    <TableCell>
                      <Tag
                        tone={
                          c.paid ? 'green' : isOverdue(c) ? 'orange' : 'neutral'
                        }
                      >
                        {c.paid ? 'Paid' : isOverdue(c) ? 'Overdue' : 'Unpaid'}
                      </Tag>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        className="text-button"
                        onClick={() => openClient(c.id, 'fees')}
                      >
                        {c.paid ? 'Details' : 'Review'}
                        <ArrowUpRight size={15} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </section>
      </>
    );
  }
  function ClientToday() {
    return (
      <>
        {heading(
          'MONDAY, 7 SEPTEMBER',
          <>
            Your next step, {client.name.split(' ')[0]}
            <span className="green-dot">.</span>
          </>,
          'A little stronger. A little more consistent. One day at a time.',
          <Button
            variant="outline"
            className="secondary"
            onClick={() => setModal('contact')}
          >
            <MessageCircle size={17} />
            Contact trainer
          </Button>,
        )}
        <div className="client-today-grid">
          <div>
            {client.plan ? (
              <section className="today-workout">
                <div className="section-heading">
                  <span className="plan-label">
                    <span className="live-dot" />
                    ON YOUR PLAN TODAY
                  </span>
                  <span className="workout-badge">SESSION 01</span>
                </div>
                <p className="today-program">{client.plan}</p>
                <h2>
                  {currentPlan.days === 4 ? (
                    <>
                      Upper body.
                      <br />
                      Steady progress.
                    </>
                  ) : (
                    <>
                      Full body.
                      <br />
                      Fresh energy.
                    </>
                  )}
                </h2>
                <div className="plan-meta">
                  <span>
                    <Dumbbell size={16} />4 exercises
                  </span>
                  <span>
                    <Clock3 size={16} />
                    45–55 min
                  </span>
                </div>
                <div className="today-workout-bottom">
                  <Button className="primary" onClick={startWorkout}>
                    <Play size={16} />
                    {sessionLogs[selected]?.length
                      ? 'View completed workout'
                      : 'Start workout'}
                  </Button>
                  <span>Coach Sachin has your back.</span>
                </div>
              </section>
            ) : (
              <Empty
                icon={<Dumbbell />}
                title="You're in the right place."
                text="Sachin will assign your first workout here. For now, take a look around."
              />
            )}
            {client.plan && WeekSchedule()}
            <div className="client-mini-grid">
              <button
                className="panel action-card"
                onClick={() => go('My diet')}
              >
                <span className="action-icon">
                  <Sprout size={23} />
                </span>
                <div>
                  <span className="eyebrow">FUEL YOUR DAY</span>
                  <h3>My diet</h3>
                  <p>{client.diet || 'Your plan is coming soon'}</p>
                </div>
                <ArrowUpRight size={21} />
              </button>
              <button className="panel action-card" onClick={openCheckin}>
                <span className="action-icon peach">
                  <ClipboardCheck size={23} />
                </span>
                <div>
                  <span className="eyebrow">A MOMENT TO REFLECT</span>
                  <h3>Weekly check-in</h3>
                  <p>
                    {client.checkedIn
                      ? 'Submitted · Update anytime'
                      : 'Let Sachin know how you feel'}
                  </p>
                </div>
                <ArrowUpRight size={21} />
              </button>
            </div>
            {client.response && (
              <div className="coach-note">
                <span className="avatar coach">SP</span>
                <div>
                  <strong>A few words from Sachin</strong>
                  <p>{client.response}</p>
                </div>
              </div>
            )}
          </div>
          <aside className="client-rail">
            <section className="panel consistency-card">
              <p className="eyebrow">EVERY SESSION COUNTS</p>
              <h2>Your week so far</h2>
              <div className="consistency-number">
                {client.completed}
                <span> / {client.total}</span>
              </div>
              <p>planned sessions completed</p>
              <Progress
                className="studio-progress"
                value={
                  client.total ? (client.completed / client.total) * 100 : 0
                }
              />
              <Button
                variant="ghost"
                className="text-button"
                onClick={() => go('My progress')}
              >
                See your progress
                <ArrowRight size={16} />
              </Button>
            </section>
            {client.fee > 0 && !client.paid && (
              <section className="fee-reminder">
                <div className="section-heading">
                  <Wallet size={20} />
                  <Tag tone={isOverdue(client) ? 'orange' : 'neutral'}>
                    {isOverdue(client) ? 'Overdue' : 'Upcoming'}
                  </Tag>
                </div>
                <h3>September coaching</h3>
                <strong>{money(client.fee)}</strong>
                <p>
                  Due{' '}
                  {new Date(client.due + 'T12:00:00').toLocaleDateString(
                    'en-GB',
                    { day: 'numeric', month: 'long' },
                  )}
                </p>
                <Button variant="outline" onClick={() => go('My fees')}>
                  View fee <ArrowUpRight size={16} />
                </Button>
              </section>
            )}
            <div className="trainer-card">
              <span className="avatar coach">SP</span>
              <div>
                <small>YOUR TRAINER</small>
                <strong>Sachin</strong>
                <p>One conversation away.</p>
              </div>
            </div>
          </aside>
        </div>
      </>
    );
  }
  function WorkoutSession() {
    let index = 0;
    const done = sets.filter((s) => s.done).length;
    if (sessionFinished)
      return (
        <div className="finish-screen">
          <span className="finish-icon">
            <CheckCircle2 size={44} />
          </span>
          <p className="eyebrow">ANOTHER STEP FORWARD</p>
          <h1>You showed up.</h1>
          <p>
            {done} sets logged. Your progress is ready for Sachin to review.
          </p>
          <div className="finish-stats">
            <div>
              <strong>{done}</strong>
              <small>Sets completed</small>
            </div>
            <div>
              <strong>
                {sets.filter((s) => s.done).reduce((a, s) => a + s.reps, 0)}
              </strong>
              <small>Total reps</small>
            </div>
          </div>
          <Button
            className="primary"
            onClick={() => {
              setTraining(false);
              go('My progress');
            }}
          >
            View my progress
            <ArrowRight size={16} />
          </Button>
        </div>
      );
    return (
      <>
        <button
          className="back-link"
          onClick={() => {
            setTraining(false);
            go('Today');
          }}
        >
          <ArrowLeft size={15} />
          Back to today
        </button>
        {heading(
          'TODAY’S WORKOUT',
          currentPlan.days === 4 ? 'Upper body A' : 'Full body A',
          'Log what you actually do. Your assigned targets stay beside you.',
          <Tag>
            {done} / {sets.length} sets
          </Tag>,
        )}
        <Progress
          value={sets.length ? (done / sets.length) * 100 : 0}
          className="studio-progress session-progress"
        />
        {currentPlan.exercises.map((e, i) => {
          const start = index;
          index += e.sets;
          return (
            <section className="panel logging-card" key={e.name}>
              <div className="section-heading">
                <div className="person">
                  <span className="exercise-number">0{i + 1}</span>
                  <div>
                    <h2>{e.name}</h2>
                    <p>
                      Target: {e.sets} × {e.reps} at {e.weight} kg · Rest 90 sec
                    </p>
                  </div>
                </div>
              </div>
              <div className="set-grid set-header">
                <span>SET</span>
                <span>WEIGHT · KG</span>
                <span>REPS</span>
                <span>DONE</span>
              </div>
              {sets.slice(start, start + e.sets).map((s, j) => (
                <div className={`set-grid ${s.done ? 'set-done' : ''}`} key={j}>
                  <span>{j + 1}</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={s.weight}
                    aria-label={`${e.name} set ${j + 1} weight`}
                    onChange={(ev) =>
                      setSets((all) =>
                        all.map((x, k) =>
                          k === start + j
                            ? { ...x, weight: Number(ev.target.value) }
                            : x,
                        ),
                      )
                    }
                  />
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={s.reps}
                    aria-label={`${e.name} set ${j + 1} reps`}
                    onChange={(ev) =>
                      setSets((all) =>
                        all.map((x, k) =>
                          k === start + j
                            ? { ...x, reps: Number(ev.target.value) }
                            : x,
                        ),
                      )
                    }
                  />
                  <Checkbox
                    checked={s.done}
                    aria-label={`Complete ${e.name} set ${j + 1}`}
                    onCheckedChange={(v) =>
                      setSets((all) =>
                        all.map((x, k) =>
                          k === start + j ? { ...x, done: !!v } : x,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </section>
          );
        })}
        <div className="session-footer">
          <p>
            {done === sets.length
              ? 'All sets logged. Nicely done.'
              : `${done} of ${sets.length} sets logged. You can save a partial session.`}
          </p>
          <Button
            className="primary"
            disabled={
              done === 0 ||
              sets.some((s) => s.done && (s.reps < 1 || s.weight < 0))
            }
            onClick={() => {
              updateClient({
                completed: Math.min(client.total, client.completed + 1),
              });
              setSessionLogs((logs) => ({
                ...logs,
                [selected]: [
                  {
                    title:
                      currentPlan.days === 4 ? 'Upper body A' : 'Full body A',
                    sets: sets.map((s) => ({ ...s })),
                    targets: currentPlan.exercises.map(
                      (e) =>
                        `${e.name} · ${e.sets} × ${e.reps} at ${e.weight} kg`,
                    ),
                  },
                ],
              }));
              setSessionFinished(true);
              toast.success('Workout saved in this preview');
              window.scrollTo({ top: 0, behavior: 'instant' });
            }}
          >
            <Check size={18} />
            Finish workout
          </Button>
        </div>
      </>
    );
  }
  function Empty({
    icon,
    title,
    text,
    action,
  }: {
    icon: ReactNode;
    title: string;
    text: string;
    action?: ReactNode;
  }) {
    return (
      <div className="empty-state">
        <span>{icon}</span>
        <h3>{title}</h3>
        <p>{text}</p>
        {action}
      </div>
    );
  }
  const modalTitles: Record<string, string> = {
    invite: 'Make room for someone new.',
    workout: 'Their plan. Your guidance.',
    diet: 'A little structure. Better habits.',
    checkin: 'How is your week going?',
    payment: 'Your coaching, taken care of.',
    paid: 'Confirm payment received',
    newfee: 'Coaching fee details',
    contact: 'Keep the conversation going.',
    correction: 'Correct payment status',
    reset: 'Start fresh?',
  };
  const modalDescriptions: Record<string, string> = {
    invite: 'Invite a client to join your coaching studio.',
    workout: 'Assign a personal copy of a reusable workout plan.',
    diet: 'Assign a meal plan and add a personal note.',
    checkin: 'A short check-in helps Sachin coach you better.',
    payment: 'Payment preview only. No money will be collected.',
    paid: 'Check your payment account before marking this fee paid.',
    newfee: 'Set a fee for September coaching. This preview uses INR.',
    contact: 'Longer conversations happen in WhatsApp.',
    correction: 'Return this fee to unpaid and keep a record of why.',
    reset: 'Reset all sample assignments, check-ins, payments, and clients.',
  };
  return (
    <SidebarProvider style={{ '--sidebar-width': '224px' } as CSSProperties}>
      <Sidebar className="studio-sidebar">
        <SidebarHeader>
          <button
            onClick={() => go(role === 'trainer' ? 'Overview' : 'Today')}
            className="brand"
          >
            <span className="brand-mark">
              <Activity size={24} />
            </span>
            transforma<span className="brand-dot">.</span>
          </button>
          <span className="studio-label">COACHING STUDIO</span>
        </SidebarHeader>
        <SidebarContent>
          <p className="nav-caption">
            {role === 'trainer' ? 'WORKSPACE' : 'YOUR SPACE'}
          </p>
          <StudioNav
            nav={nav}
            onNav={go}
            pending={pending.length}
            role={role}
          />
        </SidebarContent>
        <SidebarFooter>
          <div className="studio-note">
            <span className="live-dot" />
            YOUR STUDIO
            <br />
            <strong>
              Small steps.
              <br />
              Stronger people.
            </strong>
          </div>
          <div className="coach-account">
            {role === 'trainer' ? (
              <span className="avatar coach">SP</span>
            ) : (
              <Avatar person={client} />
            )}
            <div>
              <strong>
                {role === 'trainer' ? 'Sachin' : client.name.split(' ')[0]}
              </strong>
              <small>
                {role === 'trainer'
                  ? 'Personal trainer'
                  : 'Your coaching journey'}
              </small>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="app-shell">
        <div className="preview-strip">
          <span>
            <span className="live-dot" />
            Design preview{' '}
            <span className="preview-detail">/ Fictional sample data</span>
          </span>
          <div className="preview-controls">
            <button
              className="reset-preview"
              onClick={() => setModal('reset')}
              aria-label="Reset prototype"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
            <Tabs value={role} onValueChange={(v) => switchRole(String(v))}>
              <TabsList className="role-switch">
                <TabsTrigger value="trainer">Trainer</TabsTrigger>
                <TabsTrigger value="client">Client</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-menu" />
            {role === 'trainer'
              ? 'Studio'
              : client.name.split(' ')[0] + '’s space'}
            <ChevronRight size={14} />
            <strong>{detail ? client.name : nav}</strong>
          </div>
          <div className="header-date">
            <span>Monday, 7 September</span>
            {role === 'trainer' ? (
              <span className="avatar coach small-avatar">SP</span>
            ) : (
              <Avatar person={client} />
            )}
          </div>
        </header>
        <main
          className={`${role === 'client' ? 'client-main' : ''} ${detail ? 'detail-main' : ''}`}
        >
          {role === 'trainer' ? (
            detail ? (
              ClientDetail()
            ) : nav === 'Overview' ? (
              Dashboard()
            ) : nav === 'Clients' ? (
              <>
                {heading(
                  'YOUR PEOPLE',
                  'Every client has a story.',
                  'Keep their goals, plans, and progress in one place.',
                  inviteButton,
                )}
                {ClientTable()}
              </>
            ) : nav === 'Workouts' ? (
              Templates({ kind: 'workout' })
            ) : nav === 'Diets' ? (
              Templates({ kind: 'diet' })
            ) : nav === 'Check-ins' ? (
              Checkins()
            ) : (
              Fees()
            )
          ) : training ? (
            WorkoutSession()
          ) : nav === 'Today' ? (
            ClientToday()
          ) : nav === 'My workouts' ? (
            <>
              {heading(
                'YOUR TRAINING',
                'Built for your next step.',
                'Your weekly plan, with guidance from Sachin.',
              )}
              {WorkoutPanel()}
            </>
          ) : nav === 'My diet' ? (
            <>
              {heading(
                'NOURISH THE ROUTINE',
                'Fuel for the everyday.',
                'Your current meal plan, assigned by Sachin.',
              )}
              {DietPanel()}
            </>
          ) : nav === 'My progress' ? (
            <>
              {heading(
                'LOOK HOW FAR YOU’VE COME',
                'Progress is personal.',
                'Your training, your trends, your words.',
              )}
              {ProgressPanel()}
            </>
          ) : (
            <>
              {heading(
                'THE BUSINESS SIDE',
                'Your coaching fees.',
                'A clear record of what is due and what is paid.',
              )}
              {FeePanel()}
            </>
          )}
          <footer className="page-footer">
            <span>transforma Studio</span>
            <span>
              <a href="/source.zip" download>
                Source
              </a>{' '}
              · Built around your people.
            </span>
          </footer>
        </main>
      </div>
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="studio-dialog">
          <DialogHeader>
            <div className="dialog-kicker">
              <span className="brand-mark">
                <Activity size={18} />
              </span>
              TRANSFORMA STUDIO
            </div>
            <DialogTitle>{modal ? modalTitles[modal] : ''}</DialogTitle>
            <DialogDescription>
              {modal ? modalDescriptions[modal] : ''}
            </DialogDescription>
          </DialogHeader>
          {modal === 'invite' &&
            (!inviteCreated ? (
              <form onSubmit={createInvite} className="dialog-form">
                <label htmlFor="invite-name">Client name</label>
                <Input
                  id="invite-name"
                  required
                  maxLength={60}
                  value={inviteName}
                  placeholder="e.g. Priya Sharma"
                  onChange={(e) => setInviteName(e.target.value)}
                />
                <div className="info-box">
                  <LockKeyhole size={18} />
                  <p>
                    They will confirm joining your studio before sharing their
                    workout and weight history with you.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="primary"
                  disabled={!inviteName.trim()}
                >
                  <Plus size={17} />
                  Create invitation
                </Button>
              </form>
            ) : (
              <div className="dialog-form">
                <div className="success-banner">
                  <CheckCircle2 size={22} />
                  <span>Invitation ready for {inviteName}.</span>
                </div>
                <label htmlFor="invite-url">Sample invitation link</label>
                <div className="copy-field">
                  <Input
                    id="invite-url"
                    readOnly
                    value={`https://transforma.example/join/${newClientId}`}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copy sample invitation"
                    onClick={() =>
                      copy(`https://transforma.example/join/${newClientId}`)
                    }
                  >
                    <Copy size={17} />
                  </Button>
                </div>
                <p className="field-help">
                  Single use · Expires in 7 days. This sample link does not
                  invite anyone.
                </p>
                <div className="preview-callout">
                  <p>
                    Walk through the next step as {inviteName.split(' ')[0]}.
                  </p>
                  <Button className="primary" onClick={joinInvite}>
                    Accept sample invitation <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
            ))}
          {(modal === 'workout' || modal === 'diet') && (
            <form onSubmit={assign} className="dialog-form">
              <label htmlFor="assignment-client">Client</label>
              <div
                className="assignment-client-list"
                role="group"
                aria-label="Select client"
              >
                {clients.map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    variant={c.id === selected ? 'secondary' : 'ghost'}
                    className={c.id === selected ? 'selected-client' : ''}
                    onClick={() => setSelected(c.id)}
                  >
                    <Avatar person={c} />
                    {c.name.split(' ')[0]}
                  </Button>
                ))}
              </div>
              <label>
                Choose a {modal === 'workout' ? 'workout' : 'diet'} template
              </label>
              <RadioGroup
                value={String(template)}
                onValueChange={(v) => setTemplate(Number(v))}
                className="template-choices"
              >
                {(modal === 'workout' ? workoutTemplates : dietTemplates).map(
                  (p, i) => (
                    <label className="template-choice" key={p.name}>
                      <RadioGroupItem value={String(i)} id={'template-' + i} />
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.description}</small>
                      </div>
                    </label>
                  ),
                )}
              </RadioGroup>
              <label htmlFor="plan-note">
                Your note to {client.name.split(' ')[0]}
              </label>
              <Textarea
                id="plan-note"
                value={planNote}
                onChange={(e) => setPlanNote(e.target.value)}
                rows={3}
              />
              <p className="field-help">
                Only {client.name.split(' ')[0]}'s assignment changes. Completed
                workouts keep their original targets.
              </p>
              <Button className="primary" type="submit">
                Assign {modal === 'workout' ? 'workout' : 'diet'} plan{' '}
                <ArrowRight size={16} />
              </Button>
            </form>
          )}
          {modal === 'checkin' && (
            <form onSubmit={submitCheckin} className="dialog-form">
              <p className="week-label">WEEK OF 7–13 SEPTEMBER</p>
              <label htmlFor="check-weight">
                Current weight <span className="optional">optional · kg</span>
              </label>
              <Input
                id="check-weight"
                type="number"
                step="0.1"
                min="20"
                max="500"
                value={checkWeight}
                onChange={(e) => setCheckWeight(e.target.value)}
                placeholder="e.g. 78.4"
              />
              <label>How closely did you follow your diet?</label>
              <RadioGroup
                value={checkAdherence}
                onValueChange={(v) => setCheckAdherence(String(v))}
                className="adherence-options"
              >
                {['Mostly', 'Partly', 'Not followed', 'Not applicable'].map(
                  (v) => (
                    <label key={v}>
                      <RadioGroupItem value={v} />
                      {v}
                    </label>
                  ),
                )}
              </RadioGroup>
              <label htmlFor="check-note">
                Anything you want Sachin to know?{' '}
                <span className="optional">optional</span>
              </label>
              <Textarea
                id="check-note"
                rows={4}
                value={checkNote}
                onChange={(e) => setCheckNote(e.target.value)}
                placeholder="Energy, challenges, wins, or something to adjust…"
              />
              <Button type="submit" className="primary">
                <Send size={16} />
                {client.checkedIn ? 'Update check-in' : 'Share check-in'}
              </Button>
            </form>
          )}
          {modal === 'payment' && (
            <div className="dialog-form">
              <div className="checkout-preview">
                <LockKeyhole size={28} />
                <p>SEPTEMBER COACHING</p>
                <strong>{money(client.fee)}</strong>
                <span>Payable to Sachin</span>
              </div>
              <div className="info-box">
                <ExternalLink size={18} />
                <p>
                  In the live app, Pay now opens your trainer’s secure payment
                  page. This prototype does not process payments.
                </p>
              </div>
              <p className="field-help">
                Your fee stays unpaid until Sachin verifies receipt, even after
                returning from checkout.
              </p>
              <Button
                className="primary"
                onClick={() => {
                  setModal(null);
                  toast(
                    'Returned from sample checkout. Payment is still awaiting confirmation.',
                  );
                }}
              >
                Return to app <ArrowRight size={16} />
              </Button>
            </div>
          )}
          {modal === 'paid' && (
            <div className="dialog-form">
              <div className="payment-client">
                <Person person={client} />
                <strong>{money(client.fee)}</strong>
              </div>
              <label className="confirmation-check">
                <Checkbox
                  checked={confirmReceipt}
                  onCheckedChange={(v) => setConfirmReceipt(!!v)}
                />
                <span>
                  I have verified receipt of this payment in my payment account.
                </span>
              </label>
              <p className="field-help">
                This updates a sample record only. No money is moved.
              </p>
              <Button
                className="primary"
                disabled={!confirmReceipt}
                onClick={() => {
                  updateClient({
                    paid: true,
                    paymentHistory: [
                      ...client.paymentHistory,
                      'Confirmed by Sachin · 7 Sep 2026',
                    ],
                  });
                  setModal(null);
                  toast.success(
                    'Payment confirmed. The client can see it too.',
                  );
                }}
              >
                <CheckCircle2 size={17} />
                Mark as paid
              </Button>
            </div>
          )}
          {modal === 'correction' && (
            <form
              className="dialog-form"
              onSubmit={(e) => {
                e.preventDefault();
                updateClient({
                  paid: false,
                  paymentHistory: [
                    ...client.paymentHistory,
                    'Returned to unpaid by Sachin · 7 Sep 2026 · ' +
                      correctionReason.trim(),
                  ],
                });
                setModal(null);
                toast.success('Payment corrected. Change history retained.');
              }}
            >
              <label htmlFor="correction-reason">Reason for correction</label>
              <Textarea
                id="correction-reason"
                required
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="e.g. Payment was attributed to the wrong client"
              />
              <Button
                type="submit"
                className="primary"
                disabled={!correctionReason.trim()}
              >
                Return fee to unpaid
              </Button>
            </form>
          )}
          {modal === 'newfee' && (
            <form
              className="dialog-form"
              onSubmit={(e) => {
                e.preventDefault();
                updateClient({ fee: Number(feeAmount), due: feeDate });
                setModal(null);
                toast.success('Fee details updated');
              }}
            >
              <Person person={client} />
              <label htmlFor="fee-amount">Amount · INR</label>
              <Input
                id="fee-amount"
                type="number"
                min="1"
                step="1"
                required
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
              />
              <label htmlFor="fee-date">Due date</label>
              <Input
                id="fee-date"
                type="date"
                required
                value={feeDate}
                onChange={(e) => setFeeDate(e.target.value)}
              />
              <label htmlFor="fee-link">
                Payment link <span className="optional">sample only</span>
              </label>
              <Input
                id="fee-link"
                type="url"
                placeholder="https://payments.example/your-link"
                value={feeLink}
                onChange={(e) => setFeeLink(e.target.value)}
              />
              <p className="field-help">
                September coaching · 1–30 September. Links are not opened in
                this preview.
              </p>
              <Button className="primary" type="submit">
                Save fee
              </Button>
            </form>
          )}
          {modal === 'contact' && (
            <div className="dialog-form">
              <div className="contact-preview">
                <span className="avatar coach large">SP</span>
                <h3>Sachin</h3>
                <p>Your personal trainer</p>
              </div>
              <div className="info-box">
                <MessageCircle size={21} />
                <p>
                  The live app opens a private WhatsApp conversation with your
                  trainer. No trainer phone number is connected to this sample.
                </p>
              </div>
              <p className="field-help">
                For feedback inside the app, use your weekly check-in.
              </p>
              <Button className="primary" onClick={openCheckin}>
                Open weekly check-in
                <ArrowRight size={16} />
              </Button>
            </div>
          )}
          {modal === 'reset' && (
            <div className="dialog-form">
              <p>
                All preview changes will be cleared. Your real transforma data is
                not connected to this prototype.
              </p>
              <Button variant="outline" onClick={() => setModal(null)}>
                Keep exploring
              </Button>
              <Button
                className="primary"
                onClick={() => {
                  setClients(
                    initialClients.map((c) => ({
                      ...c,
                      paymentHistory: [...c.paymentHistory],
                    })),
                  );
                  setSelected('aarav');
                  switchRole('trainer');
                  setCustomNotes({});
                  setDietNotes({});
                  setSessionLogs({});
                  setModal(null);
                  toast.success('Sample studio reset');
                }}
              >
                <RotateCcw size={16} />
                Reset sample studio
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Toaster />
    </SidebarProvider>
  );
}
