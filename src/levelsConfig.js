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
  }
];