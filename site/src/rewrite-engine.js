const INTENT_RULES = [
  {
    id: "boundary",
    label: "Set a boundary",
    keywords: ["need", "stop", "can't", "cannot", "won't", "boundary", "not okay", "going forward"]
  },
  {
    id: "criticism",
    label: "Respond to criticism",
    keywords: ["critic", "blame", "fault", "accused", "feedback", "called out", "said i"]
  },
  {
    id: "correction",
    label: "Correct someone",
    keywords: ["actually", "not true", "incorrect", "wrong", "clear up", "correct", "misread"]
  },
  {
    id: "help",
    label: "Ask for help",
    keywords: ["help", "support", "need you", "can you", "please", "assist"]
  },
  {
    id: "frustration",
    label: "Express frustration",
    keywords: ["frustrated", "angry", "upset", "annoyed", "tired of", "fed up"]
  },
  {
    id: "clarify",
    label: "Clarify something",
    keywords: ["clarify", "to be clear", "understand", "what i mean", "confusing", "explain again"]
  },
  {
    id: "explain",
    label: "Explain a problem",
    keywords: ["problem", "issue", "because", "situation", "happening", "concern"]
  }
];

const INTENT_COPY = {
  explain: {
    opener: "I want to explain what is happening as clearly as I can.",
    bridge: "Here is the core issue from my side.",
    closer: "I want us focused on understanding the problem and what happens next."
  },
  boundary: {
    opener: "I want to say this clearly and respectfully.",
    bridge: "This is the line I need to hold going forward.",
    closer: "I need this boundary to be understood and respected."
  },
  criticism: {
    opener: "I hear the concern, and I want to respond clearly.",
    bridge: "This is what I need you to understand about my side of it.",
    closer: "I want the conversation to stay fair, specific, and constructive."
  },
  correction: {
    opener: "I want to clear up one part of this before it keeps drifting.",
    bridge: "The point I need to correct is this.",
    closer: "I want us working from the same facts."
  },
  frustration: {
    opener: "I want to say this without turning it into a bigger fight.",
    bridge: "What has been hard for me is this.",
    closer: "I want to address it directly without escalating it."
  },
  help: {
    opener: "I need some support, and I want to ask for it clearly.",
    bridge: "The part I need help with is this.",
    closer: "A clear response or next step would help a lot."
  },
  clarify: {
    opener: "Let me say this more clearly.",
    bridge: "What I mean is this.",
    closer: "I want to make sure we leave this conversation with the same understanding."
  }
};

const BARRIER_NOTES = {
  "Different generation": "Use plain language and avoid assuming the same context.",
  "Different emotional state": "Keep the pace steady and let silence do some work.",
  "Different authority level": "Stay respectful, but do not bury the actual request.",
  "Cultural difference": "Choose direct language over idioms or sarcasm.",
  "Power dynamic": "Keep the ask specific and anchored in observable facts.",
  Misunderstanding: "Repeat the key point once instead of adding more explanation.",
  Frustration: "Lower the temperature by slowing down and shortening sentences.",
  Defensiveness: "Lead with your goal so the other person does not only hear blame."
};

const OUTCOME_NOTES = {
  "Avoid an argument": "Keep your voice low and stop after the ask instead of over-explaining.",
  "Be taken seriously": "Say the key point early and do not soften it beyond recognition.",
  "Sound calm": "Pause between sentences and avoid stacking multiple issues at once.",
  "Sound professional": "Favor specifics over emotion-heavy examples.",
  "Sound confident": "End with the request, not with an apology.",
  "Be understood clearly": "Use short sentences and one concrete example.",
  "Set a boundary respectfully": "State what will change going forward in plain terms.",
  "Make someone laugh": "Use lightness sparingly so the message still lands.",
  "Defuse tension": "Acknowledge the temperature, then guide back to the point."
};

const TONE_GUIDANCE = {
  calm: {
    label: "Calm",
    action: "Reduce heat, slow the cadence, and strip out escalators."
  },
  friendly: {
    label: "Friendly",
    action: "Signal connection so the other person does not only hear correction."
  },
  professional: {
    label: "Professional",
    action: "Favor specifics, observable facts, and a constructive next step."
  },
  direct: {
    label: "Direct",
    action: "Land the point early instead of circling into it."
  },
  confident: {
    label: "Confident",
    action: "State the need clearly without apologizing for having one."
  },
  funny: {
    label: "Funny",
    action: "Add lightness without blurring the real point."
  },
  gentle: {
    label: "Gentle",
    action: "Lower defensiveness by softening the edges, not the meaning."
  },
  clear: {
    label: "Clear",
    action: "Shorten sentences and make the ask easy to repeat back."
  }
};

function normalizeWhitespace(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function toSentenceCase(text = "") {
  const cleaned = normalizeWhitespace(text.replace(/[!?]{2,}/g, ".").replace(/\s*([,.!?])\s*/g, "$1 "));
  if (!cleaned) {
    return "";
  }

  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      const trimmed = sentence.trim();
      if (!trimmed) {
        return "";
      }

      const lower = trimmed.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .filter(Boolean)
    .join(" ");
}

function detectIntensity(message = "") {
  const caps = (message.match(/[A-Z]/g) || []).length;
  const exclamations = (message.match(/!/g) || []).length;
  const absolutes = (message.match(/\b(always|never|every time|nothing)\b/gi) || []).length;
  return caps + exclamations * 2 + absolutes * 3;
}

export function detectIntent({ message = "", situation = "", outcome = "" }) {
  const haystack = `${message} ${situation} ${outcome}`.toLowerCase();
  let winner = INTENT_RULES[INTENT_RULES.length - 1];
  let highScore = -1;

  for (const rule of INTENT_RULES) {
    const score = rule.keywords.reduce((total, keyword) => total + (haystack.includes(keyword) ? 1 : 0), 0);
    if (score > highScore) {
      highScore = score;
      winner = rule;
    }
  }

  return winner;
}

function chooseTones(tones = []) {
  if (!Array.isArray(tones) || tones.length === 0) {
    return ["clear", "calm"];
  }

  return tones.slice(0, 3);
}

function buildToneLead(tones, relationship) {
  const active = chooseTones(tones);
  const parts = [];

  if (active.includes("friendly")) {
    parts.push(relationship ? `I value our ${relationship.toLowerCase()} dynamic.` : "I value our relationship.");
  }

  if (active.includes("professional")) {
    parts.push("For clarity, I want to keep this specific and constructive.");
  }

  if (active.includes("gentle")) {
    parts.push("I am saying this with care, not to attack you.");
  }

  if (active.includes("funny")) {
    parts.push("No drama, just honesty.");
  }

  return parts.join(" ");
}

function buildOutcomeCloser(outcome = "", afterState = "") {
  const normalized = outcome.toLowerCase();

  if (normalized.includes("argument") || normalized.includes("defuse")) {
    return "I want us to stay with the point instead of letting this turn into a fight.";
  }

  if (normalized.includes("serious")) {
    return "I am asking that this concern be taken seriously.";
  }

  if (normalized.includes("professional")) {
    return "I want to handle this respectfully and move toward a clear next step.";
  }

  if (normalized.includes("boundary")) {
    return "I am being direct now so there is less confusion later.";
  }

  if (normalized.includes("confident")) {
    return "I want to be straightforward about what I need.";
  }

  if (afterState) {
    return `My goal is for this to feel ${afterState.toLowerCase()} instead of reactive.`;
  }

  return "I want this message to be easy to hear and hard to misread.";
}

function condenseMessage(message = "") {
  const normalized = toSentenceCase(message);
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(/\b(just|literally|honestly|basically|obviously)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildAsk(intentId, outcome, barrier) {
  if (intentId === "boundary") {
    return "Going forward, I need a change in how this is handled.";
  }

  if (intentId === "help") {
    return "Can we agree on one practical next step?";
  }

  if (intentId === "correction") {
    return "Please respond to what actually happened, not the mistaken version of it.";
  }

  if (intentId === "criticism") {
    return "If there is feedback, I want it to be specific so I can respond to it well.";
  }

  if (outcome) {
    return `What I want from this conversation is simple: ${outcome.toLowerCase()}.`;
  }

  if (barrier) {
    return `Because ${barrier.toLowerCase()} is part of this, I am keeping the message simple and direct.`;
  }

  return "I want to be clear about what I mean and what I need next.";
}

function buildProof(proof = "", outcome = "", intentLabel = "") {
  if (proof) {
    return proof;
  }

  if (outcome) {
    return `Success looks like this: ${outcome.toLowerCase()}.`;
  }

  return `Success looks like a calmer conversation after this ${intentLabel.toLowerCase()}.`;
}

function buildNotes({ barrier, outcome, beforeState, tones, intensity }) {
  const notes = [];
  const active = chooseTones(tones);

  if (beforeState) {
    notes.push(`Shift from "${beforeState.toLowerCase()}" into a steadier delivery.`);
  }

  if (barrier && BARRIER_NOTES[barrier]) {
    notes.push(BARRIER_NOTES[barrier]);
  }

  if (outcome && OUTCOME_NOTES[outcome]) {
    notes.push(OUTCOME_NOTES[outcome]);
  }

  if (active.includes("direct")) {
    notes.push("Land the point in the first sentence instead of circling into it.");
  }

  if (active.includes("calm")) {
    notes.push("Keep your pace slightly slower than feels natural.");
  }

  if (intensity > 10) {
    notes.push("Your raw draft reads heated. The translated version works better if you deliver it with longer pauses.");
  }

  return notes.slice(0, 4);
}

function buildSummary({ recipient, relationship, situation, barrier, outcome }) {
  return [
    {
      label: "Audience",
      title: recipient || relationship || "Not specified",
      body: relationship ? `Dynamic: ${relationship}.` : "Add the relationship dynamic for sharper rewrites."
    },
    {
      label: "Moment",
      title: outcome || "Outcome not chosen",
      body: situation || "Describe the communication moment so the translation can match it."
    },
    {
      label: "Barrier",
      title: barrier || "No barrier selected",
      body: barrier ? BARRIER_NOTES[barrier] : "Choose the friction shaping the conversation."
    }
  ];
}

function describeIntensity(intensity) {
  if (intensity >= 12) {
    return "High";
  }

  if (intensity >= 6) {
    return "Medium";
  }

  return "Low";
}

function buildConversationMap({ recipient, relationship, barrier, beforeState, afterState, outcome }, intentLabel) {
  return [
    {
      label: "Audience",
      value: recipient || relationship || "Unspecified",
      detail: relationship ? `Dynamic: ${relationship}.` : "Add the relationship for sharper context."
    },
    {
      label: "Intent",
      value: intentLabel,
      detail: outcome ? `Target outcome: ${outcome}.` : "Choose an outcome to tighten the rewrite."
    },
    {
      label: "Friction",
      value: barrier || "Not selected",
      detail: barrier ? BARRIER_NOTES[barrier] : "Call out the barrier shaping how this will be heard."
    },
    {
      label: "Reframe",
      value: beforeState && afterState ? `${beforeState} -> ${afterState}` : afterState || beforeState || "Not selected",
      detail: afterState
        ? `The rewrite is steering toward ${afterState.toLowerCase()}.`
        : "Choose the after-state the message should land with."
    }
  ];
}

function buildToneMap(tones = []) {
  return chooseTones(tones).map((tone) => ({
    tone,
    label: TONE_GUIDANCE[tone]?.label || tone,
    action: TONE_GUIDANCE[tone]?.action || "Shape the rewrite with this tone."
  }));
}

function splitTeleprompterLines(text) {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : ["Add a message to generate teleprompter mode."];
}

export function buildTranslation(input) {
  const message = normalizeWhitespace(input.message || "");
  const detectedIntent = detectIntent(input);
  const intentId = input.intent && input.intent !== "auto" ? input.intent : detectedIntent.id;
  const intentData = INTENT_COPY[intentId] || INTENT_COPY.explain;
  const tones = chooseTones(input.tones);
  const intensity = detectIntensity(message);
  const cleanedMessage = condenseMessage(message);
  const toneLead = buildToneLead(tones, input.relationship);
  const ask = buildAsk(intentId, input.outcome, input.barrier);
  const closer = buildOutcomeCloser(input.outcome, input.afterState);
  const proof = buildProof(input.proof, input.outcome, detectedIntent.label);
  const notes = buildNotes({
    barrier: input.barrier,
    outcome: input.outcome,
    beforeState: input.beforeState,
    tones,
    intensity
  });

  const mainParts = [
    toneLead,
    intentData.opener,
    intentData.bridge,
    cleanedMessage || "I need to say this in a way that is easier to hear.",
    ask,
    closer
  ].filter(Boolean);

  const primary = mainParts.join(" ");
  const concise = [intentData.opener, cleanedMessage || ask, ask].filter(Boolean).slice(0, 3).join(" ");
  const toneMap = buildToneMap(tones);
  const intentLabel =
    (INTENT_COPY[intentId] ? INTENT_RULES.find((item) => item.id === intentId) : detectedIntent)?.label ||
    detectedIntent.label;

  return {
    detectedIntent,
    intentLabel,
    summary: buildSummary(input),
    primary,
    concise,
    proof,
    notes,
    tones,
    toneMap,
    conversationMap: buildConversationMap(input, intentLabel),
    diagnostics: {
      intensity,
      intensityLabel: describeIntensity(intensity),
      wordCount: message ? message.split(/\s+/).filter(Boolean).length : 0
    },
    teleprompterLines: splitTeleprompterLines(primary)
  };
}
