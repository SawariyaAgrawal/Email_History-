/**
 * Excel upload API - parse .xlsx and store rows as records
 * Prevents duplicate insertion by checking content hash or row identity (optional)
 */
const express = require('express');
const XLSX = require('xlsx');
const fs = require('fs');
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const REGIONS = require('../config/regions');
const router = express.Router();

router.use(auth);

// Normalize for flexible matching (R.O. vs RO, extra spaces)
function normalizeRegion(s) {
  if (s == null || s === '') return '';
  return String(s).trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

// Match cell value to canonical region from REGIONS list
function matchRegion(value) {
  if (value == null || value === '') return null;
  const n = normalizeRegion(value);
  const found = REGIONS.find((r) => normalizeRegion(r) === n);
  return found || null;
}

// POST /api/upload - Upload and parse Excel file
router.post('/', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please select an .xlsx file.' });
    }

    filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ error: 'Excel file has no sheets.' });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty or has no data rows.' });
    }

    const fileName = req.file.originalname || 'upload.xlsx';
    const recordsToInsert = [];
    const seen = new Set(); // For duplicate prevention: hash of row content

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const dataMap = new Map();
      let detectedRegion = null;
      
      // Look for region column: exact "region", or "regional office", "ro", etc.
      let regionKey = Object.keys(row).find((k) => String(k).toLowerCase().trim() === 'region');
      if (regionKey == null) {
        regionKey = Object.keys(row).find((k) => String(k).toLowerCase().includes('region'));
      }
      if (regionKey == null) {
        regionKey = Object.keys(row).find((k) => /regional?\s*office|^ro$|branch|office/i.test(String(k).trim()));
      }
      if (regionKey) {
        const regionValue = row[regionKey];
        if (regionValue != null && String(regionValue).trim() !== '') {
          const matched = matchRegion(String(regionValue).trim());
          if (matched) {
            detectedRegion = matched;
          } else {
            // Even if not in REGIONS list, use the value from Region column
            detectedRegion = String(regionValue).trim();
          }
        }
      }
      
      // Build the data map
      for (const [key, value] of Object.entries(row)) {
        if (key !== undefined && key !== null && String(key).trim() !== '') {
          const k = String(key).trim();
          dataMap.set(k, value);
        }
      }

      // If still no region detected, try matching any cell value against REGIONS
      if (!detectedRegion) {
        for (const [key, value] of Object.entries(row)) {
          const v = value != null ? String(value).trim() : '';
          if (v) {
            const matched = matchRegion(v);
            if (matched) {
              detectedRegion = matched;
              break;
            }
          }
        }
      }

      const finalRegion = detectedRegion || '';

      // Skip completely empty rows
      if (dataMap.size === 0) continue;

      const rowSignature = JSON.stringify(Object.fromEntries(dataMap));
      if (seen.has(rowSignature)) continue; // Prevent duplicate record insertion
      seen.add(rowSignature);

      recordsToInsert.push({
        data: Object.fromEntries(dataMap),
        uploaded_by: req.user.id,
        source_file: fileName,
        row_index: i + 1,
        region: finalRegion,
      });
    }

    if (recordsToInsert.length === 0) {
      return res.status(400).json({ error: 'No valid data rows found in the Excel file.' });
    }

    const { error } = await supabase.from('records').insert(recordsToInsert);
    if (error) throw error;

    res.status(201).json({
      message: 'File uploaded successfully.',
      count: recordsToInsert.length,
    });
  } catch (err) {
    console.error('Upload error:', err);
    if (err.message && err.message.includes('password')) {
      return res.status(400).json({ error: 'Protected or invalid Excel file.' });
    }
    res.status(500).json({ error: 'Failed to process Excel file.' });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('Cleanup upload file error:', e);
      }
    }
  }
});

module.exports = router;
