/**
 * Records API - fetch all records and single record by ID
 * PRODUCTION VERSION - Paginated fetch, robust region filtering
 */
const express = require('express');
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

const COLUMNS = 'id, data, region, source_file, row_index, last_visit_date, created_at';
const PAGE_SIZE = 1000;

function normalizeRegion(s) {
  if (s == null || s === '') return '';
  return String(s)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace(/\s*-\s*/g, ' - ')
    .trim();
}

async function paginatedFetch(buildQuery) {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// GET /api/records - Filter by region
router.get('/', async (req, res) => {
  try {
    const region = req.query.region;
    const regionTrimmed = region ? String(region).trim() : '';
    const matchRegion = regionTrimmed && regionTrimmed.toLowerCase() !== 'all' ? regionTrimmed : null;

    console.log(`[records] Fetching records, region=${regionTrimmed || 'All'}`);

    let filtered;

    if (matchRegion) {
      // Step 1: case-insensitive exact match via ilike (handles casing differences)
      filtered = await paginatedFetch((from, to) =>
        supabase
          .from('records')
          .select(COLUMNS)
          .ilike('region', matchRegion)
          .order('created_at', { ascending: false })
          .range(from, to)
      );
      console.log(`[records] ilike match: ${filtered.length} records`);

      // Step 2: if nothing found, fall back to normalized matching (handles R.O. vs RO, extra spaces, etc.)
      if (filtered.length === 0) {
        console.log('[records] ilike match failed, trying normalized match...');
        const allRecords = await paginatedFetch((from, to) =>
          supabase
            .from('records')
            .select(COLUMNS)
            .order('created_at', { ascending: false })
            .range(from, to)
        );
        const normalizedMatch = normalizeRegion(matchRegion);
        filtered = allRecords.filter((r) => normalizeRegion(r.region) === normalizedMatch);
        console.log(`[records] Normalized match: ${filtered.length} records`);
      }
    } else {
      filtered = await paginatedFetch((from, to) =>
        supabase
          .from('records')
          .select(COLUMNS)
          .order('created_at', { ascending: false })
          .range(from, to)
      );
    }

    console.log(`[records] Returning ${filtered.length} records`);

    const normalized = filtered.map((r) => ({
      _id: String(r.id),
      data: r.data || {},
      sourceFile: r.source_file,
      rowIndex: r.row_index,
      region: r.region,
      lastVisitDate: r.last_visit_date,
      createdAt: r.created_at,
    }));

    res.json(normalized);
  } catch (err) {
    console.error('[records] Error:', err);
    res.status(500).json({ error: 'Failed to fetch records.' });
  }
});

// GET /api/records/:id - Fetch a single record by ID
router.get('/:id', async (req, res) => {
  try {
    const recordId = Number(req.params.id);
    if (!Number.isFinite(recordId)) {
      return res.status(400).json({ error: 'Invalid record ID.' });
    }

    const { data: record, error } = await supabase
      .from('records')
      .select('*')
      .eq('id', recordId)
      .maybeSingle();

    if (error) throw error;
    if (!record) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    res.json({
      _id: String(record.id),
      data: record.data || {},
      sourceFile: record.source_file,
      rowIndex: record.row_index,
      region: record.region,
      lastVisitDate: record.last_visit_date,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    });
  } catch (err) {
    console.error('[records] Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch record.' });
  }
});

// PATCH /api/records/:id - Update lastVisitDate
router.patch('/:id', async (req, res) => {
  try {
    const recordId = Number(req.params.id);
    if (!Number.isFinite(recordId)) {
      return res.status(400).json({ error: 'Invalid record ID.' });
    }

    const { lastVisitDate } = req.body;
    let sanitizedDate = null;
    if (lastVisitDate) {
      const d = new Date(lastVisitDate);
      const y = d.getFullYear();
      if (isNaN(d.getTime()) || y < 1900 || y > 2100) {
        return res.status(400).json({ error: 'Invalid date. Year must be between 1900 and 2100.' });
      }
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      sanitizedDate = `${y}-${mm}-${dd}`;
    }

    const { data: record, error } = await supabase
      .from('records')
      .update({ last_visit_date: sanitizedDate })
      .eq('id', recordId)
      .select('id, last_visit_date')
      .maybeSingle();

    if (error) throw error;
    if (!record) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    res.json({
      _id: String(record.id),
      lastVisitDate: record.last_visit_date,
    });
  } catch (err) {
    console.error('[records] Update error:', err);
    res.status(500).json({ error: 'Failed to update record.' });
  }
});

module.exports = router;