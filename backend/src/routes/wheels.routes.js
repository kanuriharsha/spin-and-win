const router = require('express').Router();
const Wheel = require('../models/wheel.model');
const SpinResult = require('../models/spinResult.model');

const DEFAULT_FORM_CONFIG = {
  enabled: true,
  title: 'Enter Your Details',
  subtitle: 'Please fill in your information to spin the wheel',
  fields: {
    surname: { enabled: true, label: 'Surname/Initial', required: true },
    name: { enabled: true, label: 'Full Name', required: true },
    amountSpent: { enabled: true, label: 'Amount Spent on Food', required: true },
    privacyPolicy: {
      enabled: true,
      text: 'I agree to the privacy policy and terms of service',
      policyText: 'Your privacy is important to us. We collect and use your information only for the purpose of this promotion.'
    }
  },
  submitButtonText: 'Next',
  backgroundColor: '#ffffff',
  textColor: '#2c3e50',
  buttonColor: '#3498db'
};

// Merge helper (restored)
function mergeFormConfig(incoming = {}) {
  return {
    ...DEFAULT_FORM_CONFIG,
    ...incoming,
    fields: {
      ...DEFAULT_FORM_CONFIG.fields,
      ...(incoming.fields || {}),
      surname: { ...DEFAULT_FORM_CONFIG.fields.surname, ...(incoming.fields?.surname || {}) },
      name: { ...DEFAULT_FORM_CONFIG.fields.name, ...(incoming.fields?.name || {}) },
      amountSpent: { ...DEFAULT_FORM_CONFIG.fields.amountSpent, ...(incoming.fields?.amountSpent || {}) },
      privacyPolicy: { ...DEFAULT_FORM_CONFIG.fields.privacyPolicy, ...(incoming.fields?.privacyPolicy || {}) }
    }
  };
}

// Sanitize rules array on segments
function sanitizeRules(rules) {
  if (!Array.isArray(rules)) return [];
  const allowed = new Set(['>', '>=', '<', '<=', '==', '!=']);
  return rules
    .map(r => ({
      op: String(r?.op || '').trim(),
      amount: Number(r?.amount),
      dailyLimit: Number(r?.dailyLimit)
    }))
    .filter(r =>
      allowed.has(r.op) &&
      Number.isFinite(r.amount) && r.amount >= 0 &&
      Number.isFinite(r.dailyLimit) && r.dailyLimit >= 0 && r.dailyLimit <= 1000
    );
}

// Normalize segments (adds rules)
const normalizeSegments = (segments = []) =>
  segments.map((segment) => {
    // Remove probability normalization
    // New: normalize limit-related fields only
    let dailyLimit = segment?.dailyLimit;
    if (dailyLimit === '' || dailyLimit === undefined || dailyLimit === null) {
      dailyLimit = null;
    } else {
      dailyLimit = Math.max(0, Math.floor(Number(dailyLimit) || 0));
    }
    let dailyRemaining = segment?.dailyRemaining;
    if (dailyLimit === null) {
      dailyRemaining = null;
    } else {
      const base = Number.isFinite(dailyRemaining) ? Math.floor(dailyRemaining) : dailyLimit;
      dailyRemaining = Math.max(0, Math.min(dailyLimit, base));
    }
    return {
      ...segment,
      dailyLimit,
      dailyRemaining,
      lastResetAt: segment?.lastResetAt || undefined,
      rules: sanitizeRules(segment?.rules)
    };
  });

// Helper to sanitize spin duration: allow 1..60 seconds, else null
function sanitizeSpinDurationSec(value) {
  if (value === '' || value === undefined || value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(1, Math.min(60, n));
  return clamped;
}

// New: sanitize center image radius (SVG units)
function sanitizeCenterImageRadius(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 70;
  return Math.max(20, Math.min(160, Math.floor(n)));
}

// New: sanitize spin base turns
function sanitizeSpinBaseTurns(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 6;
  return Math.max(1, Math.min(20, Math.floor(n)));
}

// Rule matching helpers (used in spin)
function matchRule(op, lhs, rhs) {
  switch (op) {
    case '>': return lhs > rhs;
    case '>=': return lhs >= rhs;
    case '<': return lhs < rhs;
    case '<=': return lhs <= rhs;
    case '==': return lhs == rhs; // eslint-disable-line eqeqeq
    case '!=': return lhs != rhs; // eslint-disable-line eqeqeq
    default: return false;
  }
}
function effectiveLimitForAmount(segment, amountSpentNum) {
  const rules = Array.isArray(segment.rules) ? segment.rules : [];
  for (const r of rules) {
    if (matchRule(r.op, amountSpentNum, r.amount)) {
      return r.dailyLimit; // first matching rule wins
    }
  }
  return segment.dailyLimit;
}

// New helpers for daily reset & weighted pick (server local time)
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

async function ensureDailyResetIfNeeded(wheel) {
  const today0 = startOfToday().getTime();
  let changed = false;
  const nextSegments = wheel.segments.map((s) => {
    const seg = s.toObject ? s.toObject() : s;
    if (seg.dailyLimit == null) {
      if (seg.dailyRemaining != null || seg.lastResetAt) {
        seg.dailyRemaining = null;
        seg.lastResetAt = undefined;
        changed = true;
      }
      return seg;
    }
    const last = seg.lastResetAt ? new Date(seg.lastResetAt).getTime() : null;
    if (last !== today0) {
      seg.dailyRemaining = seg.dailyLimit;
      seg.lastResetAt = new Date(today0);
      changed = true;
    }
    return seg;
  });
  if (changed) {
    wheel.segments = nextSegments;
    await wheel.save();
  }
  return wheel;
}

function pickWeightedIndexFromEligible(segments) {
  const eligible = segments
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.dailyLimit == null || (s.dailyRemaining ?? 0) > 0);

  if (eligible.length === 0) return null;

  // Uniform pick among eligible (probabilities removed)
  const pick = Math.floor(Math.random() * eligible.length);
  return eligible[pick].i;
}

// List all wheels
router.get('/', async (req, res, next) => {
  try {
    const wheels = await Wheel.find().select('-segments.image -centerImage').sort({ updatedAt: -1 });
    res.json(wheels);
  } catch (err) {
    next(err);
  }
});

// Fetch by route name (keep before :id)
router.get('/route/:routeName', async (req, res, next) => {
  try {
    const wheel = await Wheel.findOne({ routeName: req.params.routeName.toLowerCase() });
    if (!wheel) return res.status(404).json({ message: 'Wheel not found' });
    await ensureDailyResetIfNeeded(wheel);
    res.json(wheel);
  } catch (err) {
    next(err);
  }
});

// Fetch by id
router.get('/:id', async (req, res, next) => {
  try {
    // Guard bad ids like 'undefined' to prevent 500s
    if (!req.params.id || req.params.id === 'undefined') {
      return res.status(400).json({ message: 'Invalid wheel id' });
    }
    const wheel = await Wheel.findById(req.params.id);
    if (!wheel) {
      return res.status(404).json({ message: 'Wheel not found' });
    }
    await ensureDailyResetIfNeeded(wheel);
    res.json(wheel);
  } catch (err) {
    next(err);
  }
});

// Create
router.post('/', async (req, res, next) => {
  try {
    const routeName = req.body.routeName?.toLowerCase();
    if (await Wheel.findOne({ routeName })) {
      return res.status(400).json({ message: 'This URL is already in use. Please choose a different one.' });
    }
    const preparedSegments = normalizeSegments(req.body.segments).map((s) => {
      if (s.dailyLimit == null) return s;
      return { ...s, dailyRemaining: s.dailyLimit, lastResetAt: startOfToday() };
    });
    const wheel = await Wheel.create({
      ...req.body,
      routeName,
      segments: preparedSegments,
      formConfig: mergeFormConfig(req.body.formConfig),
      spinDurationSec: sanitizeSpinDurationSec(req.body.spinDurationSec),
      spinBaseTurns: sanitizeSpinBaseTurns(req.body.spinBaseTurns),
      centerImageRadius: sanitizeCenterImageRadius(req.body.centerImageRadius)
    });
    res.status(201).json(wheel);
  } catch (err) {
    next(err);
  }
});

// Update
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.params.id || req.params.id === 'undefined') {
      return res.status(400).json({ message: 'Invalid wheel id' });
    }

    // Normalize and guard routeName uniqueness
    if (req.body.routeName) {
      const routeName = req.body.routeName.toLowerCase();
      const exists = await Wheel.findOne({ routeName, _id: { $ne: req.params.id } });
      if (exists) {
        return res.status(400).json({ message: 'This URL is already in use. Please choose a different one.' });
      }
      req.body.routeName = routeName;
    }

    const existing = await Wheel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Wheel not found' });

    const updateDoc = {
      ...req.body,
      formConfig: mergeFormConfig(req.body.formConfig),
      updatedAt: Date.now()
    };

    // Segments: only update if provided, else keep as-is
    if (Array.isArray(req.body.segments)) {
      const normalized = normalizeSegments(req.body.segments);
      const segmentsToSave = normalized.map((seg, idx) => {
        const prev = existing.segments[idx] || {};
        if (seg.dailyLimit == null) {
          return { ...seg, dailyRemaining: null, lastResetAt: undefined };
        }
        if (prev.dailyLimit == null) {
          return { ...seg, dailyRemaining: seg.dailyLimit, lastResetAt: startOfToday() };
        }
        const remaining = Number.isFinite(seg.dailyRemaining)
          ? Math.min(seg.dailyLimit, Math.max(0, Math.floor(seg.dailyRemaining)))
          : Math.min(seg.dailyLimit, Math.max(0, Math.floor(prev.dailyRemaining ?? seg.dailyLimit)));
        return { ...seg, dailyRemaining: remaining, lastResetAt: prev.lastResetAt || startOfToday() };
      });
      updateDoc.segments = segmentsToSave;
    }

    // Optional fields: only sanitize and set when provided
    if ('spinDurationSec' in req.body)
      updateDoc.spinDurationSec = sanitizeSpinDurationSec(req.body.spinDurationSec);
    if ('spinBaseTurns' in req.body)
      updateDoc.spinBaseTurns = sanitizeSpinBaseTurns(req.body.spinBaseTurns);
    if ('centerImageRadius' in req.body)
      updateDoc.centerImageRadius = sanitizeCenterImageRadius(req.body.centerImageRadius);

    const updatedWheel = await Wheel.findByIdAndUpdate(req.params.id, updateDoc, { new: true });
    res.json(updatedWheel);
  } catch (err) {
    next(err);
  }
});

// Delete (used by Dashboard)
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.params.id || req.params.id === 'undefined') {
      return res.status(400).json({ message: 'Invalid wheel id' });
    }
    const deleted = await Wheel.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Wheel not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// New: spin endpoint enforcing single spin per session, saving result
router.post('/:id/spin', async (req, res, next) => {
  try {
    const wheel = await Wheel.findById(req.params.id);
    if (!wheel) return res.status(404).json({ message: 'Wheel not found' });

    const sessionId = req.headers['x-session-id'] || req.body?.sessionId;
    if (!sessionId) return res.status(400).json({ message: 'Missing session id' });

    const session = await SpinResult.findById(sessionId);
    if (!session) return res.status(400).json({ message: 'Invalid session' });
    if (String(session.wheelId) !== String(wheel._id)) {
      return res.status(400).json({ message: 'Session does not belong to this wheel' });
    }
    if (session.winner) {
      return res.status(409).json({ message: 'This session has already spun' });
    }

    await ensureDailyResetIfNeeded(wheel);

    const amountNum = Number(session.amountSpent);
    const segments = wheel.segments.map((s) => s.toObject ? s.toObject() : s);

    // Build eligible list using effective limit from rules
    const eligible = segments
      .map((s, i) => {
        const effLimit = effectiveLimitForAmount(s, amountNum);
        if (effLimit === 0) return null; // blocked by rule
        if (s.dailyLimit != null) {
          const rem = Number.isFinite(s.dailyRemaining) ? s.dailyRemaining : s.dailyLimit;
          if (rem <= 0) return null;
        }
        return { s, i };
      })
      .filter(Boolean);

    if (eligible.length === 0) {
      return res.status(409).json({ message: 'No segments available for your entry. Please try again later.' });
    }

    // Uniform pick among eligible
    const pick = Math.floor(Math.random() * eligible.length);
    const { i: index } = eligible[pick];
    const seg = segments[index];

    // Decrement remaining if this segment is globally limited
    if (seg.dailyLimit != null) {
      wheel.segments[index].dailyRemaining = Math.max(0, (seg.dailyRemaining ?? seg.dailyLimit) - 1);
      wheel.markModified('segments');
      await wheel.save();
    }

    // Persist spin result
    session.winner = seg.text;
    session.outTime = new Date();
    await session.save();

    res.json({ index, text: seg.text });
  } catch (err) {
    next(err);
  }
});

// Error handler for this router
router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = router;
