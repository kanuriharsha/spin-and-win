const router = require('express').Router();
const Wheel = require('../models/wheel.model');

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

const normalizeSegments = (segments = []) =>
  segments.map((segment) => {
    const weight = Number(segment?.probability);
    return {
      ...segment,
      probability: Number.isFinite(weight) && weight >= 0 ? weight : 1
    };
  });

const mergeFormConfig = (incoming = {}) => ({
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
});

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
    res.json(wheel);
  } catch (err) {
    next(err);
  }
});

// Fetch by id
router.get('/:id', async (req, res, next) => {
  try {
    const wheel = await Wheel.findById(req.params.id);
    if (!wheel) {
      return res.status(404).json({ message: 'Wheel not found' });
    }
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
    const wheel = await Wheel.create({
      ...req.body,
      routeName,
      segments: normalizeSegments(req.body.segments),
      formConfig: mergeFormConfig(req.body.formConfig)
    });
    res.status(201).json(wheel);
  } catch (err) {
    next(err);
  }
});

// Update
router.put('/:id', async (req, res, next) => {
  try {
    if (req.body.routeName) {
      const routeName = req.body.routeName.toLowerCase();
      if (await Wheel.findOne({ routeName, _id: { $ne: req.params.id } })) {
        return res.status(400).json({ message: 'This URL is already in use. Please choose a different one.' });
      }
      req.body.routeName = routeName;
    }
    const updatedWheel = await Wheel.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        segments: normalizeSegments(req.body.segments),
        formConfig: mergeFormConfig(req.body.formConfig),
        updatedAt: Date.now()
      },
      { new: true }
    );
    if (!updatedWheel) return res.status(404).json({ message: 'Wheel not found' });
    res.json(updatedWheel);
  } catch (err) {
    next(err);
  }
});

// Delete wheel
router.delete('/:id', async (req, res, next) => {
  try {
    const deletedWheel = await Wheel.findByIdAndDelete(req.params.id);
    if (!deletedWheel) {
      return res.status(404).json({ message: 'Wheel not found' });
    }
    res.json({ message: 'Wheel deleted successfully' });
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
// });

// // Error handler for this router
// router.use((err, req, res, next) => {
//   console.error(err);
//   res.status(500).json({ error: err.message || 'Internal Server Error' });
// });

// module.exports = router;
