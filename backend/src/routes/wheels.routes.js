const router = require('express').Router();
const Wheel = require('../models/wheel.model');
const SpinResult = require('../models/spinResult.model');
const User = require('../models/user.model');
const Analytics = require('../models/analytics.model');
const Session = require('../models/session.model');

// New: hero banner defaults
const DEFAULT_FORM_CONFIG = {
  enabled: true,
  title: 'Enter Your Details',
  subtitle: 'Please fill in your information to spin the wheel',
  introText: '',
  heroBanner: {
    enabled: false,
    image: '',
    text: 'Welcome to Our Restaurant 🍽️ Spin & Win Your Reward!',
    textColor: '#ffffff',
    overlayOpacity: 0.4
  },
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
  customFields: [],
  submitButtonText: 'Next',
  backgroundColor: '#ffffff',
  textColor: '#2c3e50',
  buttonColor: '#3498db'
};

// Merge helper (updated to preserve heroBanner)
function mergeFormConfig(incoming = {}) {
  return {
    ...DEFAULT_FORM_CONFIG,
    ...incoming,
    introText: incoming.introText !== undefined ? incoming.introText : DEFAULT_FORM_CONFIG.introText,
    heroBanner: {
      ...DEFAULT_FORM_CONFIG.heroBanner,
      ...(incoming.heroBanner || {})
    },
    fields: {
      ...DEFAULT_FORM_CONFIG.fields,
      ...(incoming.fields || {}),
      surname: { ...DEFAULT_FORM_CONFIG.fields.surname, ...(incoming.fields?.surname || {}) },
      name: { ...DEFAULT_FORM_CONFIG.fields.name, ...(incoming.fields?.name || {}) },
      amountSpent: { ...DEFAULT_FORM_CONFIG.fields.amountSpent, ...(incoming.fields?.amountSpent || {}) },
      privacyPolicy: { ...DEFAULT_FORM_CONFIG.fields.privacyPolicy, ...(incoming.fields?.privacyPolicy || {}) }
    },
    customFields: Array.isArray(incoming.customFields) ? incoming.customFields : []
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
  if (!Number.isFinite(n)) return 112;
  return Math.max(112, Math.min(120, Math.floor(n)));
}

// New: sanitize spin base turns
function sanitizeSpinBaseTurns(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 6;
  return Math.max(1, Math.min(20, Math.floor(n)));
}

// New: sanitize session expiry minutes (allow 0 = no expiry, else 1..1440)
function sanitizeSessionExpiryMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 60;
  // allow 0 (no expiry), clamp upper bound to 1440
  return Math.max(0, Math.min(1440, Math.floor(n)));
}

// New: sanitize thank you message (max 200 chars)
function sanitizeThankYouMessage(value) {
  const s = String(value ?? 'Thanks for Availing the Offer!').trim();
  return s.length > 200 ? s.slice(0, 200) : s;
}

// Rule matching helpers (used in spin)
// These functions determine if a segment is eligible based on the user's amount spent
function matchRule(op, userAmount, ruleThreshold) {
  switch (op) {
    case '>': return userAmount > ruleThreshold;
    case '>=': return userAmount >= ruleThreshold;
    case '<': return userAmount < ruleThreshold;
    case '<=': return userAmount <= ruleThreshold;
    case '==': return userAmount == ruleThreshold; // eslint-disable-line eqeqeq
    case '!=': return userAmount != ruleThreshold; // eslint-disable-line eqeqeq
    default: return false;
  }
}

// Check if a segment is eligible based on STRICT exact-match rules
// Returns: { eligible: boolean, reason: string }
function checkSegmentEligibility(segment, amountSpentNum) {
  // First: Check base daily limit (shared pool)
  if (segment.dailyLimit != null) {
    const remaining = Number.isFinite(segment.dailyRemaining) ? segment.dailyRemaining : segment.dailyLimit;
    if (remaining <= 0) {
      return { eligible: false, reason: 'Base daily limit exhausted' };
    }
  }

  // Second: Get rules for this segment
  const rules = Array.isArray(segment.rules) ? segment.rules : [];
  
  // If NO rules defined - segment is available to everyone (backward compatible)
  if (rules.length === 0) {
    return { 
      eligible: true, 
      reason: 'No rules - available to all users' 
    };
  }

  // Rules exist - check for EXACT match
  for (const r of rules) {
    const isExactMatch = matchRule(r.op, amountSpentNum, r.amount);
    
    if (isExactMatch) {
      // Found an exact match - check rule's daily limit
      if (r.dailyLimit === 0) {
        return { 
          eligible: false, 
          reason: `Blocked by rule: amount ${r.op} ${r.amount} (dailyLimit: 0)` 
        };
      }
      
      // Rule allows access - segment is eligible
      const remaining = segment.dailyLimit != null 
        ? (Number.isFinite(segment.dailyRemaining) ? segment.dailyRemaining : segment.dailyLimit)
        : Infinity;
        
      return { 
        eligible: true, 
        reason: `Rule matched: amount ${r.op} ${r.amount} (${remaining} remaining from base limit)` 
      };
    }
  }
  
  // No rule matched - segment is NOT eligible (strict: amount must match at least one rule)
  return { 
    eligible: false, 
    reason: `No rule matches amount ${amountSpentNum} (rules exist but none match)` 
  };
}

// Determines the effective daily limit for a segment based on amount spent
// If a rule matches, the segment must satisfy BOTH:
// 1. The segment's base dailyLimit (if set)
// 2. The rule's dailyLimit
// This ensures rules can only restrict, not expand, availability
function effectiveLimitForAmount(segment, amountSpentNum) {
  const rules = Array.isArray(segment.rules) ? segment.rules : [];
  
  // Check if any rule matches
  for (const r of rules) {
    if (matchRule(r.op, amountSpentNum, r.amount)) {
      // Rule matched - return the rule's dailyLimit
      // The segment's base dailyLimit will be checked separately
      return r.dailyLimit;
    }
  }
  
  // No rule matched - return null to indicate no rule applies
  return null;
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

// New: sanitize short free-text (trim + clamp length)
function sanitizeShortText(value, max = 500) {
  const s = String(value ?? '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

// New: sanitize URL-ish strings (trim + clamp length)
function sanitizeUrlish(value, max = 500) {
  const s = String(value ?? '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

// New: sanitize hex color (#RRGGBB), else fallback
function sanitizeColor(value, fallback = '#ffffff') {
  const s = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
}

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
      description: sanitizeShortText(req.body.description, 500),
      segments: preparedSegments,
      formConfig: mergeFormConfig(req.body.formConfig),
      spinDurationSec: sanitizeSpinDurationSec(req.body.spinDurationSec),
      spinBaseTurns: sanitizeSpinBaseTurns(req.body.spinBaseTurns),
      centerImageRadius: sanitizeCenterImageRadius(req.body.centerImageRadius),
      wheelBackgroundColor: sanitizeColor(req.body.wheelBackgroundColor, '#ffffff'),
      wrapperBackgroundColor: sanitizeColor(req.body.wrapperBackgroundColor, '#ffffff'),
      sessionExpiryMinutes: sanitizeSessionExpiryMinutes(req.body.sessionExpiryMinutes),
      thankYouMessage: sanitizeThankYouMessage(req.body.thankYouMessage), // New
      instagramUrl: sanitizeUrlish(req.body.instagramUrl, 500),
      googleReviewUrl: sanitizeUrlish(req.body.googleReviewUrl, 500),
      youtubeUrl: sanitizeUrlish(req.body.youtubeUrl, 500),
      designLine: sanitizeShortText(req.body.designLine, 200)
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
        const limitChanged = prev.dailyLimit !== seg.dailyLimit;
        if (prev.dailyLimit == null || limitChanged) {
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
    // New: description optional update
    if ('description' in req.body)
      updateDoc.description = sanitizeShortText(req.body.description, 500);

    // New: optional color updates (keep previous if invalid)
    if ('wheelBackgroundColor' in req.body)
      updateDoc.wheelBackgroundColor = sanitizeColor(req.body.wheelBackgroundColor, existing.wheelBackgroundColor || '#ffffff');
    if ('wrapperBackgroundColor' in req.body)
      updateDoc.wrapperBackgroundColor = sanitizeColor(req.body.wrapperBackgroundColor, existing.wrapperBackgroundColor || '#ffffff');

    // New: optional session expiry update
    if ('sessionExpiryMinutes' in req.body)
      updateDoc.sessionExpiryMinutes = sanitizeSessionExpiryMinutes(req.body.sessionExpiryMinutes);

    // New: optional thank you message update
    if ('thankYouMessage' in req.body)
      updateDoc.thankYouMessage = sanitizeThankYouMessage(req.body.thankYouMessage);
    if ('instagramUrl' in req.body)
      updateDoc.instagramUrl = sanitizeUrlish(req.body.instagramUrl, 500);
    if ('googleReviewUrl' in req.body)
      updateDoc.googleReviewUrl = sanitizeUrlish(req.body.googleReviewUrl, 500);
    if ('youtubeUrl' in req.body)
      updateDoc.youtubeUrl = sanitizeUrlish(req.body.youtubeUrl, 500);
    if ('designLine' in req.body)
      updateDoc.designLine = sanitizeShortText(req.body.designLine, 200);

    const updatedWheel = await Wheel.findByIdAndUpdate(req.params.id, updateDoc, { new: true });
    res.json(updatedWheel);
  } catch (err) {
    next(err);
  }
});

// helper: escape regex for routeName matching
function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Delete (used by Dashboard)
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.params.id || req.params.id === 'undefined') {
      return res.status(400).json({ message: 'Invalid wheel id' });
    }

    // Find wheel first to obtain routeName
    const wheel = await Wheel.findById(req.params.id);
    if (!wheel) return res.status(404).json({ message: 'Wheel not found' });

    const routeName = String(wheel.routeName || '').trim();
    // Delete spinResults that reference this routeName (case-insensitive)
    if (routeName) {
      const regex = new RegExp(`^${escapeRegExp(routeName)}$`, 'i');
      await SpinResult.deleteMany({ routeName: regex });
    }

    // Delete the wheel document
    await Wheel.findByIdAndDelete(req.params.id);

    return res.json({ ok: true, deletedSpinResultsForRoute: routeName || null });
  } catch (err) {
    next(err);
  }
});

// Spin endpoint with device-specific session tracking
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

    // Check for device-specific active session
    const deviceFingerprint = session.sessionId;
    const expiryMinutes = (typeof wheel.sessionExpiryMinutes === 'number') ? wheel.sessionExpiryMinutes : 60;
    
    if (expiryMinutes > 0) {
      const activeDeviceSession = await Session.findOne({
        deviceFingerprint,
        routeName: wheel.routeName,
        wheelId: wheel._id,
        expiresAt: { $gt: new Date() }
      });

      if (activeDeviceSession) {
        const remainingMs = activeDeviceSession.expiresAt.getTime() - Date.now();
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        return res.status(429).json({ 
          message: `Please wait ${remainingMinutes} minute(s) before spinning again from this device`,
          remainingMinutes
        });
      }
    }

    await ensureDailyResetIfNeeded(wheel);

    const amountNum = Number(session.amountSpent);
    const segments = wheel.segments.map((s) => s.toObject ? s.toObject() : s);
    
    if (segments.some(s => s.prizeType === 'percentage') && !(Number.isFinite(amountNum) && amountNum > 0)) {
      return res.status(400).json({ message: 'Amount Spent on Food is required for percentage rewards' });
    }

    const eligibilityResults = segments.map((s, i) => {
      const result = checkSegmentEligibility(s, amountNum);
      return { s, i, ...result };
    });

    const eligible = eligibilityResults.filter(r => r.eligible);

    console.log('=== Spin Eligibility Check ===');
    console.log('Device:', deviceFingerprint);
    console.log('Amount spent:', amountNum);
    console.log('Expiry minutes:', expiryMinutes);
    eligibilityResults.forEach((r, idx) => {
      console.log(`Segment ${idx} (${r.s.text}):`, r.eligible ? '✓ ELIGIBLE' : '✗ NOT ELIGIBLE', '|', r.reason);
    });
    console.log('Total eligible:', eligible.length);
    console.log('==============================');

    if (eligible.length === 0) {
      return res.status(409).json({ message: 'No offers available at this moment. Please try again tomorrow.' });
    }

    const pick = Math.floor(Math.random() * eligible.length);
    const { i: index } = eligible[pick];
    const seg = segments[index];

    if (seg.dailyLimit != null) {
      wheel.segments[index].dailyRemaining = Math.max(0, (seg.dailyRemaining ?? seg.dailyLimit) - 1);
      wheel.markModified('segments');
      await wheel.save();
    }

    let userId = null;
    if (seg.prizeType === 'loyalty') {
      const pointsMatch = String(seg.amount || '').match(/(\d+)/);
      const points = pointsMatch ? parseInt(pointsMatch[1], 10) : 0;
      
      if (points > 0) {
        let user = await User.findOne({ surname: session.surname, name: session.name });
        if (!user) {
          user = await User.create({
            surname: session.surname,
            name: session.name,
            loyaltyPoints: 0,
            pointsHistory: []
          });
        }
        user.loyaltyPoints += points;
        user.pointsHistory.push({
          wheelId: wheel._id,
          spinResultId: session._id,
          points,
          prize: seg.text,
          timestamp: new Date()
        });
        await user.save();
        userId = user._id;
      }
    }

    let percentageValue = null;
    let computedReward = null;
    let originalAmountSpent = Number(session.amountSpent);
    
    if (seg.prizeType === 'percentage') {
      const pctMatch = String(seg.amount || '').match(/[\d.]+/);
      const pct = pctMatch ? parseFloat(pctMatch[0]) : null;
      const spent = originalAmountSpent;
      if (pct !== null && Number.isFinite(spent)) {
        percentageValue = pct;
        computedReward = Number((spent * pct / 100).toFixed(2));
      }
    }

    const payable = (percentageValue !== null && Number.isFinite(originalAmountSpent) && Number.isFinite(computedReward))
      ? Math.max(0, Number((originalAmountSpent - computedReward).toFixed(2)))
      : null;
    
    const prizeAmountForDB = (percentageValue !== null && computedReward !== null)
      ? String(computedReward)
      : (seg.amount || '');

    session.winner = seg.text;
    session.prizeType = seg.prizeType || 'other';
    session.prizeAmount = prizeAmountForDB;
    session.percentageValue = percentageValue;
    session.computedReward = computedReward;
    session.userId = userId;
    session.outTime = new Date();
    
    if (seg.prizeType === 'percentage' && payable !== null) {
      session.amountSpent = String(payable);
    }
    
    await session.save();

    // Create device-specific session record
    if (expiryMinutes > 0) {
      const expiresAt = new Date(Date.now() + expiryMinutes * 60000);
      
      await Session.findOneAndUpdate(
        {
          deviceFingerprint,
          routeName: wheel.routeName,
          wheelId: wheel._id
        },
        {
          lastSpinAt: new Date(),
          expiresAt,
          winner: seg.text,
          prizeType: seg.prizeType || 'other',
          prizeAmount: prizeAmountForDB,
          percentageValue,
          computedReward
        },
        { upsert: true, new: true }
      );
      
      console.log('Created device session:', {
        deviceFingerprint,
        routeName: wheel.routeName,
        expiresAt,
        expiryMinutes
      });
    }

    const analyticsRecord = await Analytics.create({
      wheelId: wheel._id,
      spinResultId: session._id,
      routeName: session.routeName,
      surname: session.surname,
      name: session.name,
      amountSpent: session.amountSpent,
      userId: userId,
      rewardGranted: true,
      rewardType: seg.prizeType || 'other',
      rewardText: seg.text,
      cashAmount: seg.prizeType === 'cash' ? seg.amount : '',
      loyaltyPoints: seg.prizeType === 'loyalty' ? (String(seg.amount || '').match(/(\d+)/) ? parseInt(String(seg.amount || '').match(/(\d+)/)[1], 10) : 0) : 0,
      percentageOff: seg.prizeType === 'percentage' ? percentageValue : null,
      discountAmount: seg.prizeType === 'percentage' ? computedReward : null,
      originalPrice: seg.prizeType === 'percentage' ? originalAmountSpent : null,
      finalPrice: seg.prizeType === 'percentage' ? payable : null,
      approved: false,
      sessionCreatedAt: session.inTime,
      rewardClaimedAt: new Date(),
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      sessionId: session.sessionId
    });

    res.json({ 
      index, 
      text: seg.text,
      prizeType: seg.prizeType || 'other',
      prizeAmount: prizeAmountForDB,
      percentageValue,
      computedReward,
      analyticsId: analyticsRecord._id
    });
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
