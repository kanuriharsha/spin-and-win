const router = require('express').Router();
const SpinResult = require('../models/spinResult.model');
const Wheel = require('../models/wheel.model');
const Session = require('../models/session.model'); // New import

// helper: sanitize a label so it can be used safely as a Mongo key (no dots, no leading $)
function sanitizeKey(key) {
  if (!key) return '';
  let s = String(key).trim();
  s = s.replace(/\./g, '_');          // no dots
  if (s.length === 0) return '';
  if (s[0] === '$') s = `_${s.slice(1) || Date.now()}`;
  return s;
}

// List latest by wheel id
router.get('/wheel/:wheelId', async (req, res, next) => {
  try {
    const results = await SpinResult.find({ wheelId: req.params.wheelId }).sort({ createdAt: -1 });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// List latest by route name
router.get('/route/:routeName', async (req, res, next) => {
  try {
    const results = await SpinResult.find({ routeName: req.params.routeName }).sort({ createdAt: -1 });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// Start a session after form submit OR when form is disabled (anonymous session)
router.post('/session', async (req, res, next) => {
  try {
    const { wheelId, routeName } = req.body || {};

    if (!wheelId || !routeName) {
      return res.status(400).json({ message: 'wheelId and routeName are required' });
    }

    const wheel = await Wheel.findById(wheelId).lean();
    if (!wheel || (wheel.routeName || '').toLowerCase() !== String(routeName || '').toLowerCase()) {
      return res.status(400).json({ message: 'Invalid wheelId or routeName' });
    }

    const formEnabled = !!(wheel.formConfig?.enabled);
    const surname = (req.body.surname || '').trim();
    const name = (req.body.name || '').trim();
    const amountSpent = (req.body.amountSpent || '').trim();

    // Only validate if form is enabled AND field is both enabled AND required
    if (formEnabled) {
      const fields = wheel.formConfig?.fields || {};
      
      // Check surname: must be enabled AND required AND empty
      if (fields.surname?.enabled && fields.surname?.required && !surname) {
        return res.status(400).json({ message: `${fields.surname.label || 'Surname'} is required` });
      }
      
      // Check name: must be enabled AND required AND empty
      if (fields.name?.enabled && fields.name?.required && !name) {
        return res.status(400).json({ message: `${fields.name.label || 'Name'} is required` });
      }
      
      // Check amountSpent: must be enabled AND required AND empty
      if (fields.amountSpent?.enabled && fields.amountSpent?.required && amountSpent === '') {
        return res.status(400).json({ message: `${fields.amountSpent.label || 'Amount Spent'} is required` });
      }

      // Check custom fields: only if enabled AND required
      if (Array.isArray(wheel.formConfig?.customFields)) {
        for (const field of wheel.formConfig.customFields) {
          if (field.enabled && field.required) {
            const value = (req.body[field.id] || '').trim();
            if (!value) {
              return res.status(400).json({ message: `${field.label} is required` });
            }
          }
        }
      }
    }

    // Build a case-insensitive lookup of incoming body keys for robustness
    const body = req.body || {};
    const bodyKeyMap = {};
    Object.keys(body).forEach(k => {
      bodyKeyMap[k.toLowerCase()] = k;
    });

    const customFieldData = {};

    // For each declared custom field, store it under the visible label (sanitized)
    if (Array.isArray(wheel.formConfig?.customFields)) {
      wheel.formConfig.customFields.forEach(field => {
        if (!field) return;
        const rawLabel = String(field.label || '').trim();
        const labelKey = sanitizeKey(rawLabel) || String(field.id || '').trim();
        
        const candidates = [
          labelKey,
          rawLabel,
          String(field.id || ''),
          String(field.id || '').toLowerCase(),
          rawLabel.toLowerCase()
        ].filter(Boolean);

        let found = undefined;
        for (const cand of candidates) {
          const actual = bodyKeyMap[cand.toLowerCase()] || cand;
          if (Object.prototype.hasOwnProperty.call(body, actual)) {
            const v = body[actual];
            found = v !== undefined && v !== null ? String(v).trim() : '';
            break;
          }
        }

        customFieldData[labelKey] = found !== undefined ? found : '';
      });
    }

    // Capture any additional keys that were submitted but not declared
    const knownKeys = new Set([
      'wheelid','routename','surname','name','amountspent','formenabled',
      'intime','useragent','ipaddress','sessionid','_csrf','submit'
    ].map(k => k.toLowerCase()));

    Object.keys(body).forEach((k) => {
      const kl = k.toLowerCase();
      if (knownKeys.has(kl)) return;
      
      const alreadyCaptured = Object.keys(customFieldData).some(existingKey => {
        return existingKey.toLowerCase() === k.toLowerCase() || String(existingKey).toLowerCase() === k.toLowerCase();
      });
      if (alreadyCaptured) return;
      
      const safeKey = sanitizeKey(k) || k;
      const raw = body[k];
      customFieldData[safeKey] = raw !== undefined && raw !== null ? String(raw).trim() : '';
    });

    const doc = await SpinResult.create({
      wheelId,
      routeName,
      surname: surname || '',
      name: name || '',
      amountSpent: amountSpent || '',
      customFieldData,
      formEnabled,
      inTime: new Date(),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      sessionId: req.sessionID || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    });

    res.status(201).json({ sessionId: doc._id });
  } catch (err) {
    next(err);
  }
});

// New: Check if user already spun (by device fingerprint)
router.post('/check-session', async (req, res, next) => {
  try {
    const { routeName, deviceFingerprint } = req.body;
    
    if (!routeName) {
      return res.status(400).json({ message: 'routeName is required' });
    }
    
    if (!deviceFingerprint) {
      return res.status(400).json({ message: 'deviceFingerprint is required' });
    }

    const wheel = await Wheel.findOne({ routeName }).lean();
    if (!wheel) {
      return res.status(404).json({ message: 'Wheel not found' });
    }

    // Treat 0 as "no expiry" → allow unlimited spins
    const expiryMinutes = (typeof wheel.sessionExpiryMinutes === 'number') ? wheel.sessionExpiryMinutes : 60;
    if (expiryMinutes === 0) {
      return res.json({ hasSpun: false });
    }

    // Check for active session for this device
    const activeSession = await Session.findOne({
      deviceFingerprint,
      routeName,
      wheelId: wheel._id,
      expiresAt: { $gt: new Date() }
    }).sort({ lastSpinAt: -1 });

    if (activeSession) {
      const remainingMs = activeSession.expiresAt.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      
      return res.json({
        hasSpun: true,
        winner: activeSession.winner,
        prizeAmount: activeSession.prizeAmount,
        prizeType: activeSession.prizeType,
        percentageValue: activeSession.percentageValue,
        computedReward: activeSession.computedReward,
        outTime: activeSession.lastSpinAt,
        expiresAt: activeSession.expiresAt,
        remainingMinutes,
        thankYouMessage: wheel.thankYouMessage || 'Thanks for Availing the Offer!'
      });
    }

    res.json({ hasSpun: false });
  } catch (err) {
    next(err);
  }
});

// Save spin result
router.put('/session/:sessionId/result', async (req, res, next) => {
  try {
    const updateData = { 
      winner: req.body.winner, 
      outTime: new Date() 
    };
    
    if (req.body.prizeType) {
      updateData.prizeType = req.body.prizeType;
    }
    if (req.body.prizeAmount !== undefined) {
      updateData.prizeAmount = req.body.prizeAmount;
    }
    if (req.body.userId) {
      updateData.userId = req.body.userId;
    }
    if (req.body.percentageValue !== undefined) {
      updateData.percentageValue = req.body.percentageValue;
    }
    if (req.body.computedReward !== undefined) {
      updateData.computedReward = req.body.computedReward;
    }
    
    const updated = await SpinResult.findByIdAndUpdate(
      req.params.sessionId,
      updateData,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Session not found' });

    // Create device session after successful spin result save
    if (updated.sessionId && updated.routeName) {
      const wheel = await Wheel.findById(updated.wheelId).lean();
      if (wheel) {
        const expiryMinutes = (typeof wheel.sessionExpiryMinutes === 'number') ? wheel.sessionExpiryMinutes : 60;
        
        if (expiryMinutes > 0) {
          const expiresAt = new Date(Date.now() + expiryMinutes * 60000);
          
          await Session.findOneAndUpdate(
            {
              deviceFingerprint: updated.sessionId,
              routeName: updated.routeName,
              wheelId: updated.wheelId
            },
            {
              lastSpinAt: new Date(),
              expiresAt,
              winner: req.body.winner,
              prizeType: req.body.prizeType,
              prizeAmount: req.body.prizeAmount,
              percentageValue: req.body.percentageValue,
              computedReward: req.body.computedReward
            },
            { upsert: true, new: true }
          );
        }
      }
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Update approval flag
router.put('/:id/approve', async (req, res, next) => {
  try {
    const updated = await SpinResult.findByIdAndUpdate(
      req.params.id,
      { approved: !!req.body.approved },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Result not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Local error handler
router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = router;
