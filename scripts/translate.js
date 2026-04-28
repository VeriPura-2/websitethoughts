#!/usr/bin/env node
/**
 * Usage: node scripts/translate.js <GOOGLE_CLOUD_API_KEY>
 *
 * Reads locales/en.json, translates every string value to Thai (th) and
 * Brazilian Portuguese (pt-BR), writes locales/th.json and locales/pt.json.
 *
 * HTML markup is preserved via format:'html' — <br>, <cite>, <a>, <strong>
 * tags in JSON values will survive translation intact.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.argv[2];
if (!API_KEY) {
  console.error('Usage: node scripts/translate.js <GOOGLE_CLOUD_API_KEY>');
  process.exit(1);
}

const LOCALES_DIR = path.join(__dirname, '..', 'locales');
const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));

// Batch size: API allows up to 128 segments per request
const BATCH_SIZE = 100;

function translateRequest(texts, target) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      q: texts,
      target: target,
      format: 'html',  // preserves all HTML tags inside string values
      source: 'en'
    });

    const options = {
      hostname: 'translation.googleapis.com',
      path: `/language/translate/v2?key=${API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error('API error ' + parsed.error.code + ': ' + parsed.error.message));
            return;
          }
          resolve(parsed.data.translations.map(function (t) { return t.translatedText; }));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function translateBatch(texts, target) {
  const results = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const translated = await translateRequest(batch, target);
    results.push(...translated);
    if (i + BATCH_SIZE < texts.length) {
      // Brief pause between batches to avoid rate-limit bursts
      await new Promise(function (r) { setTimeout(r, 200); });
    }
  }
  return results;
}

async function buildLocale(targetLang) {
  const keys = Object.keys(en);
  const toTranslate = [];
  const indices = [];

  for (let i = 0; i < keys.length; i++) {
    const val = en[keys[i]];
    if (typeof val === 'string' && val.trim() !== '') {
      toTranslate.push(val);
      indices.push(i);
    }
  }

  console.log('Translating ' + toTranslate.length + ' strings to ' + targetLang + '...');
  const translated = await translateBatch(toTranslate, targetLang);

  const result = Object.assign({}, en);
  for (let j = 0; j < indices.length; j++) {
    result[keys[indices[j]]] = translated[j];
  }
  return result;
}

async function main() {
  const targets = [
    { lang: 'th',   apiCode: 'th'    },
    { lang: 'pt',   apiCode: 'pt-BR' }
  ];

  for (const { lang, apiCode } of targets) {
    try {
      const locale = await buildLocale(apiCode);
      const outPath = path.join(LOCALES_DIR, lang + '.json');
      fs.writeFileSync(outPath, JSON.stringify(locale, null, 2), 'utf8');
      console.log('✓  Written ' + outPath);
    } catch (err) {
      console.error('✗  Failed for ' + lang + ': ' + err.message);
      process.exit(1);
    }
  }

  console.log('\nDone. Open locales/th.json and locales/pt.json to review before pushing.');
}

main();
