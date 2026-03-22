const INTENT_RULES = [
  {
    id: "boundary",
    label: "Set a boundary",
    keywords: [
      "stop",
      "can't keep",
      "cannot keep",
      "won't",
      "boundary",
      "not okay",
      "going forward",
      "from now on",
      "has to change"
    ]
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
    keywords: ["help", "support", "need you", "need help", "need more help", "can you", "please", "assist"]
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

const RELATIONSHIP_GUIDANCE = {
  "Spouse or partner": {
    lead: "I care about us, so I want to say this with love and respect.",
    notes: [
      "Keep the message warm, respectful, and focused on repair instead of blame.",
      "Speak to the relationship, not just the problem."
    ],
    tones: ["gentle", "clear", "calm"]
  },
  "Child or teenager": {
    lead: "I want to be clear and steady so this lands with care.",
    notes: [
      "Use simple language and keep the emotional temperature low.",
      "Lead with care and keep the boundary easy to understand."
    ],
    tones: ["clear", "gentle", "calm"]
  },
  Friend: {
    lead: "I value our friendship, and I want to say this honestly and kindly.",
    notes: [
      "Stay direct without sounding cold.",
      "Make it sound human and easy to hear."
    ],
    tones: ["friendly", "clear", "gentle"]
  },
  Coworker: {
    lead: "I want to keep this clear, respectful, and easy to work from.",
    notes: [
      "Keep it constructive and specific.",
      "Favor clarity over emotional detail."
    ],
    tones: ["professional", "clear", "direct"]
  },
  "Boss or supervisor": {
    lead: "I want to be respectful and clear while still being honest.",
    notes: [
      "Keep the point grounded in facts and next steps.",
      "Be respectful without burying the real concern."
    ],
    tones: ["professional", "clear", "confident"]
  },
  "Employee or subordinate": {
    lead: "I want this to be clear, respectful, and supportive.",
    notes: [
      "Be direct about the issue and calm about the delivery.",
      "Make the next step easy to follow."
    ],
    tones: ["clear", "professional", "gentle"]
  },
  Customer: {
    lead: "I want to keep this clear, helpful, and respectful.",
    notes: [
      "Reduce friction and guide toward a practical next step.",
      "Keep the message concise and service-minded."
    ],
    tones: ["professional", "friendly", "clear"]
  },
  Client: {
    lead: "I want this to sound thoughtful, clear, and dependable.",
    notes: [
      "Keep the message polished and specific.",
      "Protect trust while addressing the real point."
    ],
    tones: ["professional", "clear", "confident"]
  },
  Stranger: {
    lead: "I want to keep this simple, respectful, and easy to understand.",
    notes: [
      "Use plain language and avoid extra detail.",
      "Keep boundaries clear and the message brief."
    ],
    tones: ["clear", "direct", "calm"]
  },
  "Online conversation": {
    lead: "I want to keep this grounded, clear, and hard to misread.",
    notes: [
      "Avoid sarcasm and say the point plainly.",
      "Shorter sentences will travel better here."
    ],
    tones: ["clear", "direct", "calm"]
  },
  "Social media comment": {
    lead: "I want this to be clear, brief, and less reactive.",
    notes: [
      "Keep it short and do not over-explain.",
      "Say enough to land the point, then stop."
    ],
    tones: ["direct", "clear", "calm"]
  }
};

const TONE_GUIDANCE = {
  calm: {
    label: "Calm",
    action: "Reduce heat, slow the cadence, and strip out escalators."
  },
  respectful: {
    label: "Respectful",
    action: "Stay direct without sounding punishing, sarcastic, or dismissive."
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

const AFTER_STATE_TONES = {
  Clear: ["clear", "calm"],
  Respectful: ["respectful", "clear", "calm"],
  Calm: ["calm", "respectful", "clear"],
  Smart: ["clear", "confident", "professional"],
  Short: ["direct", "clear"],
  Confident: ["confident", "direct", "clear"],
  Funny: ["funny", "friendly", "clear"],
  "Easy to understand": ["clear", "calm"]
};

const META_LEAD_PATTERNS = [
  /^(?:[A-Z][a-z]+,\s*)?i care about us\b/i,
  /^(?:[A-Z][a-z]+,\s*)?i want to say this\b/i,
  /^(?:[A-Z][a-z]+,\s*)?let me say this more clearly\b/i,
  /^(?:[A-Z][a-z]+,\s*)?what i mean is\b/i,
  /^(?:[A-Z][a-z]+,\s*)?i am saying this with care\b/i,
  /^(?:[A-Z][a-z]+,\s*)?i want to explain\b/i,
  /^(?:[A-Z][a-z]+,\s*)?i hear the concern\b/i
];

const META_CLAUSE_PATTERNS = [
  /^(?:[A-Z][a-z]+,\s*)?i care about us,?\s*(?:so|and)?\s*/i,
  /^(?:[A-Z][a-z]+,\s*)?let me say this more clearly[,:-]?\s*/i,
  /^(?:[A-Z][a-z]+,\s*)?i want to say this(?:\s+with\s+[^,]+)?[,:-]?\s*/i,
  /^(?:[A-Z][a-z]+,\s*)?what i mean is(?:\s+this)?[,:-]?\s*/i,
  /^(?:[A-Z][a-z]+,\s*)?i am saying this with care(?:,\s*not to attack you)?[,:-]?\s*/i
];

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

      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    })
    .filter(Boolean)
    .join(" ");
}

function splitSentences(text = "") {
  return normalizeWhitespace(String(text || ""))
    .replace(/\s*([,.!?])\s*/g, "$1 ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function ensureSentence(text = "") {
  const cleaned = normalizeWhitespace(String(text || ""));
  if (!cleaned) {
    return "";
  }

  const withCapital = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  if (/[.!?]$/.test(withCapital)) {
    return withCapital;
  }

  return `${withCapital}.`;
}

function prependRecipient(text = "", recipient = "") {
  const sentence = ensureSentence(text);
  const name = normalizeWhitespace(recipient);

  if (!sentence || !name) {
    return sentence;
  }

  const bare = sentence.replace(/[.!?]$/, "");
  const bareLower = bare.toLowerCase();
  if (bareLower.startsWith(`${name.toLowerCase()},`)) {
    return ensureSentence(bare);
  }

  return ensureSentence(`${name}, ${bare}`);
}

function uniqueParts(parts = []) {
  const seen = new Set();
  return parts.filter((part) => {
    const cleaned = normalizeWhitespace(part).toLowerCase();
    if (!cleaned || seen.has(cleaned)) {
      return false;
    }
    seen.add(cleaned);
    return true;
  });
}

function isMetaLeadSentence(sentence = "") {
  const cleaned = normalizeWhitespace(sentence);
  return META_LEAD_PATTERNS.some((pattern) => pattern.test(cleaned));
}

export function isMetaLeadText(text = "") {
  return isMetaLeadSentence(text);
}

function stripLeadingMetaClause(sentence = "") {
  let next = normalizeWhitespace(sentence);

  for (const pattern of META_CLAUSE_PATTERNS) {
    next = next.replace(pattern, "");
  }

  return normalizeWhitespace(next);
}

export function cleanGeneratedDraft(text = "") {
  const original = normalizeWhitespace(String(text || ""));
  if (!original) {
    return "";
  }

  const sentences = splitSentences(original);
  const filtered = [...sentences];

  while (filtered.length > 1 && isMetaLeadSentence(filtered[0])) {
    filtered.shift();
  }

  if (filtered[0]) {
    const trimmedLead = stripLeadingMetaClause(filtered[0]);
    if (/[A-Za-z0-9]/.test(trimmedLead)) {
      filtered[0] = trimmedLead;
    } else if (filtered.length > 1) {
      filtered.shift();
    } else {
      filtered[0] = "";
    }
  }

  const next = filtered.filter(Boolean).length > 0 ? filtered.filter(Boolean).join(" ") : original;
  return splitSentences(next).map(ensureSentence).join(" ");
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

function chooseTones(tones = [], relationship = "", afterState = "") {
  const explicit = Array.isArray(tones) ? tones.filter(Boolean) : [];
  const derived = AFTER_STATE_TONES[String(afterState || "").trim()] || [];
  const combined = [...new Set([...explicit, ...derived])];

  if (combined.length > 0) {
    return combined;
  }

  const relationshipTones = RELATIONSHIP_GUIDANCE[relationship]?.tones;
  if (Array.isArray(relationshipTones) && relationshipTones.length > 0) {
    return relationshipTones;
  }

  if (combined.length === 0) {
    return ["clear", "calm"];
  }

  return combined;
}

function buildToneLead(tones, relationship, afterState = "", recipient = "") {
  const active = chooseTones(tones, relationship, afterState);
  const relationshipLead = RELATIONSHIP_GUIDANCE[relationship]?.lead;
  const parts = [];
  const recipientName = normalizeWhitespace(recipient);
  const recipientLead = recipientName ? `${recipientName},` : "";

  if (recipientLead) {
    parts.push(recipientLead);
  }

  if (active.includes("funny")) {
    if (relationship === "Spouse or partner") {
      parts.push("I love you, and I need to say this before the dishes start acting like permanent residents.");
    } else if (recipientName) {
      parts.push(`Tiny bit of humor, ${recipientName}, but I do mean this.`);
    } else {
      parts.push("Tiny bit of humor here, but I do mean this.");
    }
  } else if (relationshipLead) {
    parts.push(relationshipLead);
  }

  if (active.includes("friendly") && !active.includes("funny")) {
    parts.push(relationship ? `I value our ${relationship.toLowerCase()} dynamic.` : "I value our relationship.");
  }

  if (active.includes("professional")) {
    parts.push("For clarity, I want to keep this specific and constructive.");
  }

  if (active.includes("gentle")) {
    parts.push("I am saying this with care, not to attack you.");
  }

  if (active.includes("funny")) {
    parts.push("I am trying to keep this light without losing the point.");
  }

  return parts.join(" ");
}

function buildOutcomeCloser(outcome = "", afterState = "") {
  const normalized = String(outcome || "").toLowerCase();

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

  return "";
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

function stripGreeting(text = "") {
  return text
    .replace(
      /^(?:hi|hey|hello)(?:\s+(?:there|honey|hon|love|babe|baby|sweetheart|friend|everyone))?[,\s!.-]*/i,
      ""
    )
    .trim();
}

function softenPhrase(text = "") {
  return String(text || "")
    .replace(/\bit(?:'s| is)\s+(?:really\s+)?(?:getting\s+)?annoying\b/gi, "it has been frustrating")
    .replace(/\bi\s+don't\s+want\s+to\s+do\s+this\s+anymore\b/gi, "I cannot keep handling this alone")
    .replace(/\bif\s+you\s+can\s+(?:just\s+)?give\s+me\s+(?:a\s+)?little\s+hand\b/gi, "I need more help with it")
    .replace(/\bthe\s+mess\s+that\s+you(?:'ve|\s+have)\s+created\b/gi, "the cleanup that is being left behind")
    .replace(/\byou\s+keep\b/gi, "it keeps feeling like")
    .replace(/\byou\s+never\b/gi, "it feels like this is not happening")
    .replace(/\byou\s+always\b/gi, "it often feels like")
    .replace(/\breally\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractUsefulClauses(text = "") {
  return softenPhrase(stripGreeting(condenseMessage(text)))
    .split(/(?<=[.!?])\s+|,\s*|\s+(?:and then|but|so|because|and)\s+/i)
    .map((part) => normalizeWhitespace(part))
    .filter((part) => part && part.length > 18);
}

function findRelevantClause(clauses = [], pattern) {
  return clauses.find((clause) => pattern.test(clause)) || "";
}

function isCleanupTopic(haystack = "") {
  return /(dish|dishes|cleanup|clean up|mess|sink|kitchen)/i.test(haystack);
}

function buildConcernStatement(input, intentId, tones = []) {
  const situation = condenseMessage(input.situation || "");
  const messageClauses = extractUsefulClauses(input.message || "");
  const haystack = `${input.message || ""} ${input.situation || ""}`.toLowerCase();

  if (isCleanupTopic(haystack)) {
    if (tones.includes("funny")) {
      return "I need more help with the dishes and kitchen cleanup before the sink starts feeling like full-time employment.";
    }

    if (/(every time|cook|cooking|after you cook|after we cook)/i.test(haystack)) {
      return "I need more help with the dishes and kitchen cleanup, especially after we cook.";
    }

    if (/(dirty|mess|sink|pile|piling|cleanup|kitchen)/i.test(haystack)) {
      return "The dishes and kitchen cleanup have been landing on me too often.";
    }

    return "I need more help with the dishes and kitchen cleanup.";
  }

  if (/(fight|argu|snap|yell|reactive|heated|tense)/i.test(haystack)) {
    return "The tone around this has been getting too tense, and I want to reset it.";
  }

  if (/(deadline|late|behind|time|schedule)/i.test(haystack)) {
    return "I need to be honest about the timing so we can handle this well.";
  }

  if (situation) {
    return toSentenceCase(situation);
  }

  const firstClause = messageClauses[0] || "";
  if (!firstClause) {
    return intentId === "help"
      ? "I need to talk about something that has been heavy for me."
      : "Something about this has been weighing on me, and I want to say it more clearly.";
  }

  if (/^i\b/i.test(firstClause)) {
    return firstClause;
  }

  return `What has been hard for me is that ${firstClause.charAt(0).toLowerCase()}${firstClause.slice(1)}`;
}

function buildImpactStatement(input, intentId, tones = []) {
  const haystack = `${input.message || ""} ${input.situation || ""}`.toLowerCase();

  if (isCleanupTopic(haystack)) {
    if (tones.includes("funny")) {
      return "When it keeps falling to me, I stop feeling like your partner and start feeling like support staff.";
    }

    if (input.relationship === "Spouse or partner") {
      if (/(every time|cook|cooking|after you cook|after we cook)/i.test(haystack)) {
        return "A lot of it ends up sitting in the sink or on the stove, and I usually end up handling it myself. When that keeps happening, I feel worn down and unappreciated, and I do not want resentment building between us.";
      }

      return "A lot of the cleanup keeps landing on me, and I usually end up handling it myself. When that keeps happening, I feel worn down and unappreciated, and I do not want resentment building between us.";
    }

    if (/(every time|cook|cooking|after you cook|after we cook)/i.test(haystack)) {
      return "When I end up handling it on my own after we cook, I feel worn down and frustrated.";
    }

    return "When it keeps falling to me, I feel worn down.";
  }

  if (intentId === "help") {
    return "I am at the point where I cannot keep carrying it alone.";
  }

  if (intentId === "boundary") {
    return "When it keeps happening this way, it is hard for me to stay open and steady.";
  }

  if (intentId === "criticism") {
    return "When it comes in as blame, it is hard for me to respond well.";
  }

  if (intentId === "correction") {
    return "When the facts get twisted, the conversation goes sideways fast.";
  }

  if (intentId === "frustration") {
    return "I want to address it before the frustration gets any bigger.";
  }

  return "";
}

function buildRequestStatement(input, intentId, tones = []) {
  const message = condenseMessage(input.message || "");
  const messageClauses = extractUsefulClauses(input.message || "");
  const haystack = `${input.message || ""} ${input.situation || ""}`.toLowerCase();

  if (isCleanupTopic(haystack)) {
    if (tones.includes("funny")) {
      return "Can we split the dishes and kitchen cleanup more evenly so I am not the only one apparently employed by the sink?";
    }

    if (
      input.relationship === "Spouse or partner" &&
      /(every time|cook|cooking|after you cook|after we cook|stove|sink)/i.test(
        haystack
      )
    ) {
      return "Can we make cleanup after meals feel more shared so I am not carrying the dishes and stove by myself?";
    }

    if (/(wash|rinse|dishwasher|load)/i.test(haystack)) {
      return "Can you wash or at least rinse what you use after you cook so it is not all waiting for me?";
    }

    if (/(help|support|work with me|share|pitch in|hand|split|routine|schedule|days)/i.test(haystack)) {
      return "Can we split the dishes and kitchen cleanup more evenly going forward?";
    }

    if (/(every time|cook|cooking|leave|dirty|pile|piling)/i.test(haystack)) {
      return "Can we make a clear plan for the dishes and kitchen cleanup so it does not keep landing on one person?";
    }

    return "Can we share the dishes and cleanup more consistently?";
  }

  if (/(help|support|hand|pitch in|step up)/i.test(haystack) || intentId === "help") {
    return "I need more help with this instead of carrying it by myself.";
  }

  if (/(stop|can't|cannot|won't|going forward|boundary|not okay)/i.test(haystack) || intentId === "boundary") {
    return "I need this to change going forward so it does not keep landing the same way.";
  }

  if (/(clarify|understand|misread|confus)/i.test(haystack) || intentId === "clarify") {
    return "What I need most is for my meaning to come through clearly.";
  }

  if (/(deadline|late|behind|time|schedule)/i.test(haystack)) {
    return "I want us to agree on a realistic next step instead of rushing into a bad one.";
  }

  if (message) {
    return buildAsk(intentId, input.outcome, input.barrier);
  }

  return "I want to be clear about what I need next.";
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
  const active = Array.isArray(tones) && tones.length > 0 ? tones : ["clear", "calm"];

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

function relationshipNotes(relationship = "") {
  return RELATIONSHIP_GUIDANCE[relationship]?.notes || [];
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
  return (Array.isArray(tones) ? tones : []).map((tone) => ({
    tone,
    label: TONE_GUIDANCE[tone]?.label || tone,
    action: TONE_GUIDANCE[tone]?.action || "Shape the rewrite with this tone."
  }));
}

function isShortDraft(input) {
  const combined = normalizeWhitespace(`${input.message || ""} ${input.situation || ""}`);
  if (!combined) {
    return true;
  }

  const wordCount = combined.split(/\s+/).filter(Boolean).length;
  return wordCount <= 14;
}

function buildRelationshipSupport(relationship = "", tones = [], shortDraft = false) {
  if (!shortDraft) {
    return "";
  }

  if (relationship === "Spouse or partner") {
    return tones.includes("funny")
      ? "You matter to me, so I want to make this easier to hear than the version in my head."
      : "You matter to me, so I want to say this in a way that still feels loving and honest.";
  }

  if (relationship === "Boss or supervisor") {
    return "I want to handle this professionally and make the next step easy to respond to.";
  }

  if (relationship === "Coworker") {
    return "I want to keep this practical, respectful, and easy to work from.";
  }

  if (relationship === "Friend") {
    return "I care about our friendship, so I want to say this in a way that is honest without being harsh.";
  }

  if (relationship === "Child or teenager") {
    return "I want to say this steadily so the point is clear without it sounding heavier than it needs to.";
  }

  if (relationship === "Customer" || relationship === "Client") {
    return "I want this to sound thoughtful, clear, and easy to act on.";
  }

  return "";
}

export function splitTeleprompterLines(text) {
  const parts = splitSentences(cleanGeneratedDraft(text)).flatMap((part) => {
    if (part.length <= 120 || /\?$/.test(part)) {
      return [part];
    }

    const pieces = part
      .split(/\s+(?:and|but)\s+/i)
      .map((piece) => piece.replace(/,\s*$/g, "").trim())
      .map((piece) => ensureSentence(piece))
      .filter(Boolean);

    return pieces.every((piece) => piece.length >= 28) ? pieces : [part];
  });
  const deduped = parts.filter((part, index) => {
    return index === 0 || part.toLowerCase() !== parts[index - 1].toLowerCase();
  });

  return deduped.length > 0 ? deduped : ["Add a message to generate teleprompter mode."];
}

export function buildTranslation(input) {
  const message = normalizeWhitespace(input.message || "");
  const haystack = `${input.message || ""} ${input.situation || ""}`.toLowerCase();
  const detectedIntent = detectIntent(input);
  const intentId = input.intent && input.intent !== "auto" ? input.intent : detectedIntent.id;
  const intentData = INTENT_COPY[intentId] || INTENT_COPY.explain;
  const tones = chooseTones(input.tones, input.relationship, input.afterState);
  const intensity = detectIntensity(message);
  const concern = buildConcernStatement(input, intentId, tones);
  const impact = buildImpactStatement(input, intentId, tones);
  const ask = buildRequestStatement(input, intentId, tones);
  const proof = buildProof(input.proof, input.outcome, detectedIntent.label);
  const notes = buildNotes({
    barrier: input.barrier,
    outcome: input.outcome,
    beforeState: input.beforeState,
    tones,
    intensity
  });
  const notesWithRelationship = [...relationshipNotes(input.relationship), ...notes].slice(0, 4);
  const mainParts = uniqueParts([
    prependRecipient(concern, input.recipient),
    impact,
    ask
  ]);

  const primary = cleanGeneratedDraft(mainParts.join(" "));
  const concise = cleanGeneratedDraft(
    uniqueParts([prependRecipient(concern, input.recipient), ask]).join(" ")
  );
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
    notes: notesWithRelationship,
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
