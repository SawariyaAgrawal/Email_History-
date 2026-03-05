/**
 * Communications API - per-record, per-visit-date form data
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

// GET /api/records/:recordId/communications - list all visit dates with forms for this record
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

// GET /api/records/:recordId/communications/by-date?visitDate=YYYY-MM-DD - get one by visit date
router.get('/by-date', async (req, res) => {
  try {
    const recordId = Number(req.params.recordId);
    if (!Number.isFinite(recordId)) return res.status(400).json({ error: 'Invalid record ID.' });

    const visitDateStr = req.query.visitDate;
    if (!visitDateStr) return res.status(400).json({ error: 'visitDate required (YYYY-MM-DD).' });
    const dateFormatted = formatYMD(visitDateStr);
    if (!dateFormatted) return res.status(400).json({ error: 'Invalid visitDate. Year must be between 1900-2100.' });

    const { data: doc, error } = await supabase
      .from('communications')
      .select('*')
      .eq('record_id', recordId)
      .eq('visit_date', dateFormatted)
      .maybeSingle();

    if (error) throw error;
    if (!doc) return res.json(null);
    const deviationNo = doc.deviation_noticed_no != null && doc.deviation_noticed_no !== '' ? doc.deviation_noticed_no : (doc.deviation_noticed_no_and_date || '');
    res.json({
      _id: String(doc.id),
      visitDate: formatYMD(doc.visit_date),
      salesOfficerVisitDate: formatYMD(doc.sales_officer_visit_date),
      majorMinorIrregularities: doc.major_minor_irregularities || '',
      deviationNoticedNo: deviationNo,
      deviationNoticedDate: formatYMD(doc.deviation_noticed_date),
      replyReceivedByDealerDate: formatYMD(doc.reply_received_by_dealer_date),
      replySatisfactoryYesNo: doc.reply_satisfactory_yes_no || '',
      impositionOfMDGPenaltyNoticeDate: formatYMD(doc.imposition_of_mdg_penalty_notice_date),
      reminder1Date: formatYMD(doc.reminder1_date),
      reminder1ReplyDate: formatYMD(doc.reminder1_reply_date),
      reminder2Date: formatYMD(doc.reminder2_date),
      reminder2ReplyDate: formatYMD(doc.reminder2_reply_date),
      penaltyRecoverBy: doc.penalty_recover_by || '',
      penaltyRTGSDDNoAndDate: doc.penalty_rtgs_dd_no_and_date || '',
      emiDates: doc.emi_dates || '',
      transitionComplete: doc.transition_complete || '',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch.' });
  }
});

// POST /api/records/:recordId/communications - create or update (upsert by recordId + visitDate)
router.post('/', async (req, res) => {
  try {
    const recordId = Number(req.params.recordId);
    if (!Number.isFinite(recordId)) return res.status(400).json({ error: 'Invalid record ID.' });
    const body = req.body;
    const visitDateStr = body.visitDate;
    if (!visitDateStr) return res.status(400).json({ error: 'visitDate required.' });
    const visitDateFormatted = formatYMD(visitDateStr);
    if (!visitDateFormatted) return res.status(400).json({ error: 'Invalid visit date. Year must be between 1900 and 2100.' });

    const update = {
      record_id: recordId,
      visit_date: visitDateFormatted,
      sales_officer_visit_date: formatYMD(body.salesOfficerVisitDate),
      major_minor_irregularities: String(body.majorMinorIrregularities || '').trim(),
      deviation_noticed_no: String(body.deviationNoticedNo || '').trim(),
      deviation_noticed_date: formatYMD(body.deviationNoticedDate),
      reply_received_by_dealer_date: formatYMD(body.replyReceivedByDealerDate),
      reply_satisfactory_yes_no: String(body.replySatisfactoryYesNo || '').trim(),
      imposition_of_mdg_penalty_notice_date: formatYMD(body.impositionOfMDGPenaltyNoticeDate),
      reminder1_date: formatYMD(body.reminder1Date),
      reminder1_reply_date: formatYMD(body.reminder1ReplyDate),
      reminder2_date: formatYMD(body.reminder2Date),
      reminder2_reply_date: formatYMD(body.reminder2ReplyDate),
      penalty_recover_by: String(body.penaltyRecoverBy || '').trim(),
      penalty_rtgs_dd_no_and_date: String(body.penaltyRTGSDDNoAndDate || '').trim(),
      emi_dates: String(body.emiDates || '').trim(),
      transition_complete: String(body.transitionComplete || '').trim(),
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
