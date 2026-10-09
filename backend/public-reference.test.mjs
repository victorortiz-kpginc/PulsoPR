import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const reference = JSON.parse(await readFile(new URL('./reference-data/puerto-rico-municipalities.json', import.meta.url), 'utf8'));
test('official reference has 78 unique stable PR geographic codes and no additional person/data fields', () => {
  assert.equal(reference.count, 78);
  assert.equal(reference.records.length, 78);
  assert.equal(new Set(reference.records.map(r=>r.documentId)).size, 78);
  for (const r of reference.records) {
    assert.match(r.documentId, /^72\d{3}$/);
    assert.equal(r.data.code, r.documentId);
    assert.deepEqual(Object.keys(r.data).sort(), ['code','name']);
    assert.ok(r.data.name.length > 0 && r.data.name.length <= 160 && !r.data.name.endsWith(' Municipio'));
  }
  assert.equal(reference.records.find(r=>r.documentId==='72127')?.data.name, 'San Juan');
});
test('reference provenance is pinned to official publisher and a content hash, not a live unauthenticated API dependency', () => {
  assert.equal(new URL(reference.sourceUrl).hostname, 'www2.census.gov');
  assert.equal(new URL(reference.sourcePage).hostname, 'www.census.gov');
  assert.match(reference.sourceSha256, /^[0-9a-f]{64}$/);
  assert.ok(reference.sourceUrl.endsWith('/2025_Gaz_counties_national.zip'));
  assert.equal(reference.collectionId, 'municipalities');
});
