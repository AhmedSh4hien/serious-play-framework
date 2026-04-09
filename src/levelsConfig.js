export const LEVELS = [
  {
    id: "level-1-h2",
    title: "Level 1: Hydrogen Bonds",
    topic: "valency",
    prompt:
      "Welcome to the first bonding challenge. Use hydrogen atoms to create molecules.",
    allowedAtomTypes: ["H"],
    startingAtoms: [
      { typeId: "H", count: 5, random: true },
    ],
    inventory: {
      H: 5,
      O: 0,
      Cl: 0,
    },
    goal: {
      type: "multi_create",
      targets: [
        { molecule: "H2", targetCount: 2 },
      ],
    },
    quizQuestions: [
      {
        id: "l1_q1",
        text: "How many bonds can hydrogen form in this prototype?",
        options: ["1", "2", "3"],
        correctIndex: 0,
      },
      {
        id: "l1_q2",
        text: "Which molecule are you trying to make in this level?",
        options: ["H2", "O2", "HCl"],
        correctIndex: 0,
      },
    ],
  },

  {
    id: "level-2-hcl-cl2",
    title: "Level 2: Chlorine Mix",
    topic: "valency",
    prompt: "Hydrogen and chlorine can form different molecules. Create the full set of targets.",
    allowedAtomTypes: ["H", "Cl"],
    startingAtoms: [
      { typeId: "H", count: 4, random: true },
      { typeId: "Cl", count: 4, random: true },
    ],
    inventory: {
      H: 4,
      O: 0,
      Cl: 4,
    },
    goal: {
      type: "multi_create",
      targets: [
        { molecule: "H2", targetCount: 1 },
        { molecule: "Cl2", targetCount: 1 },
        { molecule: "HCl", targetCount: 2 },
      ],
    },
    quizQuestions: [
      {
        id: "l2_q1",
        text: "Which molecule in this level contains both hydrogen and chlorine?",
        options: ["H2", "Cl2", "HCl"],
        correctIndex: 2,
      },
      {
        id: "l2_q2",
        text: "Which molecule is made from two chlorine atoms?",
        options: ["HCl", "Cl2", "H2"],
        correctIndex: 1,
      },
    ],
  },

  {
    id: "level-3-o2",
    title: "Level 3: Oxygen Pairs",
    topic: "valency",
    prompt: "Oxygen can bond in pairs too. Create 2 O2 molecules.",
    allowedAtomTypes: ["O"],
    startingAtoms: [
      { typeId: "O", count: 5, random: true },
    ],
    inventory: {
      H: 0,
      O: 5,
      Cl: 0,
    },
    goal: {
      type: "multi_create",
      targets: [
        { molecule: "O2", targetCount: 2 },
      ],
    },
    quizQuestions: [
      {
        id: "l3_q1",
        text: "Which molecule are you building in this level?",
        options: ["H2", "O2", "HCl"],
        correctIndex: 1,
      },
      {
        id: "l3_q2",
        text: "Which atom type is used in this level?",
        options: ["Hydrogen", "Chlorine", "Oxygen"],
        correctIndex: 2,
      },
    ],
  },

  {
    id: "level-4-h2o",
    title: "Level 4: Water Builder",
    topic: "valency",
    prompt: "Oxygen can bond with two hydrogens. Create 1 H2O molecule.",
    allowedAtomTypes: ["H", "O"],
    startingAtoms: [
      { typeId: "H", count: 3, random: true },
      { typeId: "O", count: 2, random: true },
    ],
    inventory: {
      H: 3,
      O: 2,
      Cl: 0,
    },
    goal: {
      type: "multi_create",
      targets: [
        { molecule: "H2O", targetCount: 1 },
      ],
    },
    quizQuestions: [
      {
        id: "l4_q1",
        text: "Which atoms are needed to form water in this prototype?",
        options: ["Two hydrogen and one oxygen", "Two oxygen and one hydrogen", "Three hydrogen"],
        correctIndex: 0,
      },
      {
        id: "l4_q2",
        text: "Which molecule were you building in this level?",
        options: ["H2", "O2", "H2O"],
        correctIndex: 2,
      },
    ],
  },

  {
    id: "level-5-mixed-challenge",
    title: "Level 5: Mixed Reactions",
    topic: "valency",
    prompt: "Use everything you have learned. Create the full set of target molecules.",
    allowedAtomTypes: ["H", "O", "Cl"],
    startingAtoms: [
      { typeId: "H", count: 4, random: true },
      { typeId: "O", count: 3, random: true },
      { typeId: "Cl", count: 3, random: true },
    ],
    inventory: {
      H: 4,
      O: 3,
      Cl: 3,
    },
    goal: {
      type: "multi_create",
      targets: [
        { molecule: "H2", targetCount: 1 },
        { molecule: "O2", targetCount: 1 },
        { molecule: "HCl", targetCount: 1 },
        { molecule: "H2O", targetCount: 1 },
      ],
    },
    quizQuestions: [
      {
        id: "l5_q1",
        text: "Which molecule in this level contains hydrogen and oxygen?",
        options: ["HCl", "H2", "H2O"],
        correctIndex: 2,
      },
      {
        id: "l5_q2",
        text: "Which molecule contains hydrogen and chlorine?",
        options: ["HCl", "O2", "H2O"],
        correctIndex: 0,
      },
    ],
  }
];