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
  return String(s)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace(/\s*-\s*/g, ' - ')
    .trim();
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

    console.log('[upload.js] Processing', rows.length, 'rows from Excel file');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const dataMap = {};
      let detectedRegion = null;
      
      // STEP 1: Look for "Region" column (case-insensitive, exact match)
      let regionKey = Object.keys(row).find((k) => String(k).toLowerCase().trim() === 'region');
      
      // STEP 2: If not found, look for column containing "region"
      if (regionKey == null) {
        regionKey = Object.keys(row).find((k) => String(k).toLowerCase().includes('region'));
      }
      
      // STEP 3: Look for "Regional Office", "RO", "Office", etc.
      if (regionKey == null) {
        regionKey = Object.keys(row).find((k) => {
          const keyLower = String(k).toLowerCase().trim();
          return keyLower === 'ro' || 
                 keyLower === 'regional office' ||
                 keyLower.includes('regional') ||
                 keyLower.includes('office') ||
                 keyLower === 'branch';
        });
      }
      
      // If we found a region column, extract its value
      if (regionKey) {
        const regionValue = row[regionKey];
        if (regionValue != null && String(regionValue).trim() !== '') {
          const regionStr = String(regionValue).trim();
          
          // Try to match against known regions
          const matched = matchRegion(regionStr);
          if (matched) {
            detectedRegion = matched;
            console.log(`[upload.js] Row ${i + 1}: Found region "${detectedRegion}" from column "${regionKey}"`);
          } else {
            // Even if not in REGIONS list, use the value from Region column
            detectedRegion = regionStr;
            console.log(`[upload.js] Row ${i + 1}: Using region "${detectedRegion}" from column "${regionKey}" (not in REGIONS list)`);
          }
        }
      }
      
      // Build the data map (store all columns as JSONB)
      for (const [key, value] of Object.entries(row)) {
        if (key !== undefined && key !== null && String(key).trim() !== '') {
          const k = String(key).trim();
          dataMap[k] = value;
        }
      }

      // Rename legacy column to new name
      if (dataMap['JDE Distributor Code'] !== undefined && dataMap['SAP Code'] === undefined) {
        dataMap['SAP Code'] = dataMap['JDE Distributor Code'];
        delete dataMap['JDE Distributor Code'];
      }

      // STEP 4: If still no region detected, try matching ANY cell value against REGIONS
      if (!detectedRegion) {
        for (const [key, value] of Object.entries(row)) {
          const v = value != null ? String(value).trim() : '';
          if (v) {
            const matched = matchRegion(v);
            if (matched) {
              detectedRegion = matched;
              console.log(`[upload.js] Row ${i + 1}: Detected region "${detectedRegion}" from cell value in column "${key}"`);
              break;
            }
          }
        }
      }

      const finalRegion = detectedRegion || '';
      
      if (!finalRegion) {
        console.warn(`[upload.js] Row ${i + 1}: NO REGION DETECTED! Available columns:`, Object.keys(row).slice(0, 10));
      }

      // Skip completely empty rows
      if (Object.keys(dataMap).length === 0) {
        console.log(`[upload.js] Row ${i + 1}: Skipping empty row`);
        continue;
      }

      const rowSignature = JSON.stringify(dataMap);
      if (seen.has(rowSignature)) {
        console.log(`[upload.js] Row ${i + 1}: Skipping duplicate row`);
        continue;
      }
      seen.add(rowSignature);

      recordsToInsert.push({
        data: dataMap,
        uploaded_by: req.user.id,
        source_file: fileName,
        row_index: i + 1,
        region: finalRegion,
      });
    }

    if (recordsToInsert.length === 0) {
      return res.status(400).json({ error: 'No valid data rows found in the Excel file.' });
    }

    console.log(`[upload.js] Inserting ${recordsToInsert.length} records into database`);
    
    // Log first few regions for verification
    const sampleRegions = recordsToInsert.slice(0, 5).map((r, idx) => ({
      row: r.row_index,
      region: r.region,
      columns: Object.keys(r.data).slice(0, 5)
    }));
    console.log('[upload.js] Sample records to insert:', JSON.stringify(sampleRegions, null, 2));

    const { error } = await supabase.from('records').insert(recordsToInsert);
    if (error) {
      console.error('[upload.js] Supabase insert error:', error);
      throw error;
    }

    console.log('[upload.js] Successfully inserted', recordsToInsert.length, 'records');

    res.status(201).json({
      message: 'File uploaded successfully.',
      count: recordsToInsert.length,
    });
  } catch (err) {
    console.error('[upload.js] Upload error:', err);
    if (err.message && err.message.includes('password')) {
      return res.status(400).json({ error: 'Protected or invalid Excel file.' });
    }
    res.status(500).json({ error: 'Failed to process Excel file.' });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('[upload.js] Cleanup upload file error:', e);
      }
    }
  }
});

module.exports = router;