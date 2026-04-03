/**
 * Communications API - per-record, per-visit-date form data
 * Stores all form fields in a single JSONB column (form_data).
 */
const express = require('express');
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');
const router = express.Router({ mergeParams: true });

router.use(auth);

function safeDate(d) {
  if (!d) return null;
  const x = new Date(d);
  if (isNaN(x.getTime())) return null;
  const y = x.getUTCFullYear();
  if (y < 1900 || y > 2100) return null;
  return x;
}

function formatYMD(d) {
  if (!d) return null;
  const x = safeDate(d);
  if (!x) return null;
  const y = String(x.getUTCFullYear()).padStart(4, '0');
  const m = String(x.getUTCMonth() + 1).padStart(2, '0');
  const day = String(x.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// GET /api/records/:recordId/communications - list all visit dates
router.get('/', async (req, res) => {
  try {
    const recordId = Number(req.params.recordId);
    if (!Number.isFinite(recordId)) return res.status(400).json({ error: 'Invalid record ID.' });

    const { data: list, error } = await supabase
      .from('communications')
      .select('id, visit_date')
      .eq('record_id', recordId)
      .order('visit_date', { ascending: false });

    if (error) throw error;
    res.json((list || []).map((c) => ({ visitDate: formatYMD(c.visit_date) || c.visit_date, _id: String(c.id) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch list.' });
  }
});

// GET /api/records/:recordId/communications/by-date?visitDate=YYYY-MM-DD
router.get('/by-date', async (req, res) => {
  try {
    const recordId = Number(req.params.recordId);
    if (!Number.isFinite(recordId)) return res.status(400).json({ error: 'Invalid record ID.' });

    const visitDateStr = req.query.visitDate;
    if (!visitDateStr) return res.status(400).json({ error: 'visitDate required (YYYY-MM-DD).' });
    const dateFormatted = formatYMD(visitDateStr);
    if (!dateFormatted) return res.status(400).json({ error: 'Invalid visitDate.' });

    const { data: doc, error } = await supabase
      .from('communications')
      .select('id, visit_date, form_data')
      .eq('record_id', recordId)
      .eq('visit_date', dateFormatted)
      .maybeSingle();

    if (error) throw error;
    if (!doc) return res.json(null);

    res.json({
      _id: String(doc.id),
      visitDate: formatYMD(doc.visit_date),
      formData: doc.form_data || {},
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch.' });
  }
});

// POST /api/records/:recordId/communications - create or update
router.post('/', async (req, res) => {
  try {
    const recordId = Number(req.params.recordId);
    if (!Number.isFinite(recordId)) return res.status(400).json({ error: 'Invalid record ID.' });

    const { visitDate, formData } = req.body;
    if (!visitDate) return res.status(400).json({ error: 'visitDate required.' });
    const visitDateFormatted = formatYMD(visitDate);
    if (!visitDateFormatted) return res.status(400).json({ error: 'Invalid visit date.' });

    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({ error: 'formData object required.' });
    }

    const update = {
      record_id: recordId,
      visit_date: visitDateFormatted,
      form_data: formData,
    };

    const { data: doc, error } = await supabase
      .from('communications')
      .upsert([update], { onConflict: 'record_id,visit_date' })
      .select('id')
      .single();

    if (error) throw error;
    res.json({ _id: String(doc.id), visitDate: visitDateFormatted });
  } catch (err) {
    console.error('Communication save error:', err);
    res.status(500).json({ error: 'Failed to save communication.' });
  }
});

module.exports = router;
