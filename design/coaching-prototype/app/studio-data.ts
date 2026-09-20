export type Client = {
  id: string;
  name: string;
  initials: string;
  goal: string;
  completed: number;
  total: number;
  weight: string;
  startWeight: string;
  status: string;
  tone: string;
  color: string;
  plan: string;
  diet: string;
  fee: number;
  paid: boolean;
  due: string;
  note: string;
  adherence: string;
  response: string;
  checkedIn: boolean;
  joined?: boolean;
  paymentHistory: string[];
};
export const initialClients: Client[] = [
  {
    id: 'aarav',
    name: 'Aarav Mehta',
    initials: 'AM',
    goal: 'Build strength',
    completed: 3,
    total: 4,
    weight: '78.4',
    startWeight: '80.2',
    status: 'Review check-in',
    tone: 'orange',
    color: 'lilac',
    plan: 'Strength foundations',
    diet: 'Balanced performance',
    fee: 6000,
    paid: false,
    due: '2026-09-10',
    note: 'Energy is up this week. Can we adjust leg day? My legs still feel a little tired from the last session.',
    adherence: 'Mostly',
    response: '',
    checkedIn: true,
    paymentHistory: [],
  },
  {
    id: 'nisha',
    name: 'Nisha Kapoor',
    initials: 'NK',
    goal: 'Get stronger',
    completed: 4,
    total: 4,
    weight: '62.1',
    startWeight: '61.4',
    status: 'On track',
    tone: 'green',
    color: 'pink',
    plan: 'Strength foundations',
    diet: 'Balanced performance',
    fee: 6000,
    paid: true,
    due: '2026-09-05',
    note: 'Feeling good this week. Managed all four sessions.',
    adherence: 'Mostly',
    response:
      'A really consistent week. Keep the same weights and focus on your tempo.',
    checkedIn: true,
    paymentHistory: ['Confirmed by Sachin · 4 Sep 2026'],
  },
  {
    id: 'rohan',
    name: 'Rohan Shah',
    initials: 'RS',
    goal: 'Build consistency',
    completed: 1,
    total: 3,
    weight: '84.6',
    startWeight: '86.0',
    status: 'Needs a nudge',
    tone: 'orange',
    color: 'blue',
    plan: 'Full body reset',
    diet: 'Everyday balance',
    fee: 6000,
    paid: false,
    due: '2026-09-05',
    note: '',
    adherence: 'Partly',
    response: '',
    checkedIn: false,
    paymentHistory: [],
  },
  {
    id: 'meera',
    name: 'Meera Iyer',
    initials: 'MI',
    goal: 'Build strength',
    completed: 3,
    total: 3,
    weight: '58.2',
    startWeight: '57.0',
    status: 'Review check-in',
    tone: 'orange',
    color: 'peach',
    plan: 'Full body reset',
    diet: 'Balanced performance',
    fee: 6000,
    paid: true,
    due: '2026-09-05',
    note: 'Feeling stronger every session. Ready for the next step!',
    adherence: 'Mostly',
    response: '',
    checkedIn: true,
    paymentHistory: ['Confirmed by Sachin · 3 Sep 2026'],
  },
  {
    id: 'kabir',
    name: 'Kabir Singh',
    initials: 'KS',
    goal: 'Improve fitness',
    completed: 2,
    total: 3,
    weight: '76.8',
    startWeight: '78.1',
    status: 'On track',
    tone: 'green',
    color: 'mint',
    plan: 'Full body reset',
    diet: 'Everyday balance',
    fee: 6000,
    paid: true,
    due: '2026-09-05',
    note: 'Enjoying the shorter workouts. They fit my mornings well.',
    adherence: 'Partly',
    response:
      'Keep showing up. Three steady sessions will do more than one perfect week.',
    checkedIn: true,
    paymentHistory: ['Confirmed by Sachin · 2 Sep 2026'],
  },
  {
    id: 'ananya',
    name: 'Ananya Rao',
    initials: 'AR',
    goal: 'Build consistency',
    completed: 3,
    total: 4,
    weight: '65.3',
    startWeight: '66.8',
    status: 'On track',
    tone: 'green',
    color: 'lilac',
    plan: 'Strength foundations',
    diet: 'Everyday balance',
    fee: 6000,
    paid: true,
    due: '2026-09-05',
    note: 'Morning sessions are working much better for me.',
    adherence: 'Mostly',
    response: 'Good adjustment. Keep your morning slot this week.',
    checkedIn: true,
    paymentHistory: ['Confirmed by Sachin · 4 Sep 2026'],
  },
];
export const workoutTemplates = [
  {
    name: 'Strength foundations',
    days: 4,
    tag: 'STRENGTH',
    description:
      'A steady upper / lower split. Build confidence with the fundamentals.',
    exercises: [
      {
        name: 'Barbell bench press',
        sets: 3,
        reps: 10,
        weight: 40,
        note: 'Controlled lowering. Leave 2 reps in reserve.',
      },
      {
        name: 'Seated cable row',
        sets: 3,
        reps: 12,
        weight: 35,
        note: 'Keep your chest tall. Pause at the top.',
      },
      {
        name: 'Dumbbell shoulder press',
        sets: 3,
        reps: 10,
        weight: 12,
        note: 'Keep your ribs down throughout the movement.',
      },
      {
        name: 'Lat pulldown',
        sets: 3,
        reps: 12,
        weight: 30,
        note: 'Pull elbows down toward your pockets.',
      },
    ],
  },
  {
    name: 'Full body reset',
    days: 3,
    tag: 'FOUNDATIONS',
    description: 'Three approachable sessions to build a routine that sticks.',
    exercises: [
      {
        name: 'Goblet squat',
        sets: 3,
        reps: 10,
        weight: 16,
        note: 'Take your time and find a comfortable depth.',
      },
      {
        name: 'Dumbbell floor press',
        sets: 3,
        reps: 10,
        weight: 12,
        note: 'Pause briefly when your upper arms touch the floor.',
      },
      {
        name: 'Seated cable row',
        sets: 3,
        reps: 12,
        weight: 30,
        note: 'Keep your chest tall.',
      },
      {
        name: 'Dumbbell Romanian deadlift',
        sets: 3,
        reps: 10,
        weight: 14,
        note: 'Hinge at your hips, keeping the weights close.',
      },
    ],
  },
];
export const dietTemplates = [
  {
    name: 'Balanced performance',
    tag: 'TRAINING DAY',
    description: 'Simple meals to support a consistent training week.',
    meals: [
      {
        time: 'Breakfast',
        name: 'Oats, yogurt & fruit',
        portion: '50 g oats · 150 g plain yogurt · 1 banana',
        note: 'Add a handful of nuts if you are hungry.',
      },
      {
        time: 'Lunch',
        name: 'Rice, dal & vegetables',
        portion: '1 cup cooked rice · 1 cup dal · 1 cup vegetables',
        note: 'Include a side of curd if you like.',
      },
      {
        time: 'Afternoon snack',
        name: 'Fruit & roasted chana',
        portion: '1 seasonal fruit · 30 g roasted chana',
        note: 'Keep this simple on busy days.',
      },
      {
        time: 'Dinner',
        name: 'Roti, paneer & greens',
        portion: '2 rotis · 100 g paneer · 1 cup greens',
        note: 'Finish when comfortably satisfied.',
      },
    ],
  },
  {
    name: 'Everyday balance',
    tag: 'EVERYDAY',
    description: 'Familiar foods and flexible portions for busy schedules.',
    meals: [
      {
        time: 'Breakfast',
        name: 'Idli & sambar',
        portion: '3 idlis · 1 bowl sambar',
        note: 'Add fresh fruit on the side.',
      },
      {
        time: 'Lunch',
        name: 'Roti, dal & sabzi',
        portion: '2 rotis · 1 cup dal · 1 cup vegetables',
        note: 'Choose vegetables you enjoy.',
      },
      {
        time: 'Afternoon snack',
        name: 'Yogurt & fruit',
        portion: '150 g yogurt · 1 seasonal fruit',
        note: 'A quick option between meetings.',
      },
      {
        time: 'Dinner',
        name: 'Vegetable khichdi',
        portion: '1½ cups khichdi · ½ cup curd',
        note: 'Adjust portions with your trainer.',
      },
    ],
  },
];
export const money = (n: number) => '₹' + n.toLocaleString('en-IN');
export const isOverdue = (c: Client) => !c.paid && c.due < '2026-09-07';
export const stateLabel = (c: Client) =>
  c.checkedIn && !c.response
    ? 'Review check-in'
    : c.completed < c.total / 2
      ? 'Needs a nudge'
      : 'On track';
