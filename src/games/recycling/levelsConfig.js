import { validateLevel } from '../../framework/levelSchema.js';

export const LEVELS = [
  validateLevel({
    id: 'recycling-1',
    title: 'Level 1: Basic Sorting',
    topic: 'Electronics Recycling',
    prompt: 'A smartphone contains several components that must be separated before recycling. Drag each component into the correct bin.',
    funFact: 'A single smartphone contains over 60 different elements from the periodic table, many of which can be recovered through proper recycling.',
    allowedAtomTypes: [],
    startingAtoms: [],
    inventory: {},
    goal: {
      type: 'multi_sort',
      targets: [
        { binId: 'battery',  targetCount: 1 },
        { binId: 'plastic',  targetCount: 2 },
        { binId: 'metal',    targetCount: 1 },
      ],
      completed: false,
      completedAtMs: null,
    },
    components: [
      { id: 'battery', label: 'Battery',  binId: 'battery', color: 0xe74c3c },
      { id: 'screen',  label: 'Screen',   binId: 'plastic', color: 0x85c1e9 },
      { id: 'casing',  label: 'Casing',   binId: 'plastic', color: 0xaab7b8 },
      { id: 'sim',     label: 'SIM Tray', binId: 'metal',   color: 0xd4ac0d },
    ],
    quizQuestions: [
      {
        id: 'r1_q1',
        text: 'Why must batteries be separated from other e-waste before recycling?',
        options: [
          'They contain hazardous chemicals that can leak into the environment',
          'They are too heavy for general recycling bins',
          'They can be reused directly without processing',
          'They have no recyclable materials',
        ],
        correctIndex: 0,
      },
      {
        id: 'r1_q2',
        text: 'Which material makes up the outer casing of most modern smartphones?',
        options: ['Glass', 'Aluminium or polycarbonate plastic', 'Carbon fibre', 'Titanium'],
        correctIndex: 1,
      },
    ],
  }),

  validateLevel({
    id: 'recycling-2',
    title: 'Level 2: Internal Components',
    topic: 'Electronics Recycling',
    prompt: 'Internal components require careful sorting. Identify each part and place it in the correct recycling category.',
    funFact: 'The concentration of gold in circuit boards is higher per tonne than in most gold ore, making electronic recycling economically valuable.',
    allowedAtomTypes: [],
    startingAtoms: [],
    inventory: {},
    goal: {
      type: 'multi_sort',
      targets: [
        { binId: 'pcb',       targetCount: 1 },
        { binId: 'metal',     targetCount: 2 },
        { binId: 'hazardous', targetCount: 1 },
      ],
      completed: false,
      completedAtMs: null,
    },
    components: [
      { id: 'pcb',        label: 'Circuit Board', binId: 'pcb',       color: 0x1e8449 },
      { id: 'camera',     label: 'Camera Module', binId: 'metal',     color: 0x7d6608 },
      { id: 'speaker',    label: 'Speaker',       binId: 'metal',     color: 0x6c3483 },
      { id: 'battery_ic', label: 'Battery IC',    binId: 'hazardous', color: 0x943126 },
    ],
    quizQuestions: [
      {
        id: 'r2_q1',
        text: 'Which precious metal is commonly recovered from smartphone circuit boards?',
        options: ['Iron', 'Gold', 'Aluminium', 'Titanium'],
        correctIndex: 1,
      },
      {
        id: 'r2_q2',
        text: 'What makes integrated circuits on a battery IC hazardous to dispose of in general waste?',
        options: [
          'They contain lead and other toxic compounds',
          'They are too small to recycle',
          'They generate heat during disposal',
          'They are made entirely of plastic',
        ],
        correctIndex: 0,
      },
    ],
  }),

  validateLevel({
    id: 'recycling-3',
    title: 'Level 3: Full Disassembly',
    topic: 'Electronics Recycling',
    prompt: 'Sort all components of a fully disassembled smartphone. Apply what you have learned in the previous levels.',
    funFact: 'Recycling one million smartphones recovers approximately 35,000 lbs of copper, 772 lbs of silver, and 75 lbs of gold.',
    allowedAtomTypes: [],
    startingAtoms: [],
    inventory: {},
    goal: {
      type: 'multi_sort',
      targets: [
        { binId: 'battery',   targetCount: 1 },
        { binId: 'plastic',   targetCount: 2 },
        { binId: 'metal',     targetCount: 3 },
        { binId: 'pcb',       targetCount: 1 },
        { binId: 'hazardous', targetCount: 1 },
      ],
      completed: false,
      completedAtMs: null,
    },
    components: [
      { id: 'battery',    label: 'Battery',       binId: 'battery',   color: 0xe74c3c },
      { id: 'screen',     label: 'Screen',        binId: 'plastic',   color: 0x85c1e9 },
      { id: 'casing',     label: 'Casing',        binId: 'plastic',   color: 0xaab7b8 },
      { id: 'pcb',        label: 'Circuit Board', binId: 'pcb',       color: 0x1e8449 },
      { id: 'camera',     label: 'Camera Module', binId: 'metal',     color: 0x7d6608 },
      { id: 'speaker',    label: 'Speaker',       binId: 'metal',     color: 0x6c3483 },
      { id: 'sim',        label: 'SIM Tray',      binId: 'metal',     color: 0xd4ac0d },
      { id: 'battery_ic', label: 'Battery IC',    binId: 'hazardous', color: 0x943126 },
    ],
    quizQuestions: [
      {
        id: 'r3_q1',
        text: 'What percentage of smartphone materials can typically be recovered through proper recycling?',
        options: ['Around 80%', 'Less than 10%', 'Exactly 50%', 'None'],
        correctIndex: 0,
      },
      {
        id: 'r3_q2',
        text: 'Which UN Sustainable Development Goal does responsible electronics recycling directly support?',
        options: [
          'SDG 12: Responsible Consumption and Production',
          'SDG 3: Good Health and Well-being',
          'SDG 7: Affordable and Clean Energy',
          'SDG 9: Industry, Innovation and Infrastructure',
        ],
        correctIndex: 0,
      },
    ],
  }),
];