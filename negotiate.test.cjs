// Tests for the Mastermind solver in capture.js (negFeedback, negBestGuess, full loop)
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadSolver() {
  // Run capture.js in a minimal context, then extract the solver functions.
  // We expose them via a global after the IIFE runs.
  const src = fs.readFileSync(__dirname + '/capture.js', 'utf8');
  // Patch: expose internals for testing before the IIFE closes.
  const patched = src.replace(
    '// Auto-negocjacja: odpowiednik auto-ataku',
    'globalThis._negTest={negFeedback,negAllCandidates,negFilter,negBestGuess};\n  // Auto-negocjacja: odpowiednik auto-ataku'
  );
  class XHR { open(){} setRequestHeader(){} send(){} addEventListener(){} }
  const ctx = {
    window: { addEventListener(){}, postMessage(){} },
    location: { origin: 'https://t.test', href: 'https://t.test/' },
    XMLHttpRequest: XHR,
    URL, ArrayBuffer, TextDecoder, Blob, AbortSignal, setTimeout, clearTimeout,
    FoeRequestSignature: { sign: () => 'sig' },
    FoeBattleArmy: { plan: () => [], confirmed: () => true },
  };
  vm.runInNewContext(patched, ctx);
  return ctx._negTest;
}

const { negFeedback, negAllCandidates, negFilter, negBestGuess } = loadSolver();

// ── negFeedback ───────────────────────────────────────────────────────────────

// Helper: convert VM array to plain JS array for cross-context comparison
const plain = arr => JSON.parse(JSON.stringify(arr));

test('negFeedback: all correct', () => {
  assert.deepStrictEqual(plain(negFeedback(['a','b','c','d','e'], ['a','b','c','d','e'])),
    ['correct','correct','correct','correct','correct']);
});

test('negFeedback: all not_needed', () => {
  assert.deepStrictEqual(plain(negFeedback(['a','a','a','a','a'], ['b','b','b','b','b'])),
    ['not_needed','not_needed','not_needed','not_needed','not_needed']);
});

test('negFeedback: wrong_person basic', () => {
  assert.deepStrictEqual(plain(negFeedback(['a','b','c','d','e'], ['b','a','c','d','e'])),
    ['wrong_person','wrong_person','correct','correct','correct']);
});

test('negFeedback: duplicate goods — correct wins over wrong_person', () => {
  assert.deepStrictEqual(plain(negFeedback(['a','a','b','c','d'], ['a','b','b','c','d'])),
    ['correct','not_needed','correct','correct','correct']);
});

test('negFeedback: HAR example turn1 (petroleum correct)', () => {
  const secret = ['explosives','machineparts','petroleum','money','money'];
  const guess  = ['explosives','machineparts','petroleum','money','money'];
  assert.deepStrictEqual(plain(negFeedback(secret, guess)),
    ['correct','correct','correct','correct','correct']);
});

// ── negAllCandidates ──────────────────────────────────────────────────────────

test('negAllCandidates: 2 goods → 2^5=32 candidates', () => {
  const c = negAllCandidates(['x','y']);
  assert.equal(c.length, 32);
  assert.ok(c.every(row => row.length === 5));
  assert.ok(c.every(row => row.every(g => g === 'x' || g === 'y')));
});

test('negAllCandidates: 4 goods → 4^5=1024', () => {
  assert.equal(negAllCandidates(['a','b','c','d']).length, 1024);
});

// ── negFilter ─────────────────────────────────────────────────────────────────

test('negFilter: after correct feedback only matching secrets remain', () => {
  const goods = ['a','b','c','d'];
  let candidates = negAllCandidates(goods);
  // guess: [a,b,c,d,a], slot2 correct (c), rest wrong_person/not_needed based on secret
  const guess = ['a','b','c','d','a'];
  const slots = [{slotId:2, resourceId:'c', state:'correct'},
                 {slotId:0, resourceId:'a', state:'not_needed'},
                 {slotId:1, resourceId:'b', state:'not_needed'},
                 {slotId:3, resourceId:'d', state:'not_needed'},
                 {slotId:4, resourceId:'a', state:'not_needed'}];
  candidates = negFilter(candidates, guess, slots);
  // Every remaining candidate must have 'c' at slot 2 and no a,b,d at any slot.
  assert.ok(candidates.length > 0, 'should have candidates left');
  assert.ok(candidates.every(c => c[2] === 'c'), 'slot 2 must be c');
  assert.ok(candidates.every(c => !c.includes('a') && !c.includes('b') && !c.includes('d')),
    'a/b/d are not_needed so cannot appear');
});

// ── Full negotiation loop ─────────────────────────────────────────────────────

test('solver finds HAR negotiation solution in ≤ 3 turns', () => {
  // HAR secret (PCH): slot0=money, slot1=petroleum, slot2=correct in T3, slot3=machineparts, slot4=explosives
  // From HAR T3 all correct: money, petroleum, ?, machineparts, explosives — slot2 was already correct (petroleum)
  // Reconstruct: T1 petroleum correct at slot2 → secret[2]=petroleum
  // T2 explosives correct at slot4 → secret[4]=explosives
  // T3 all 3 remaining correct: money, petroleum(already), machineparts
  const secret = ['money','petroleum','petroleum','machineparts','explosives'];
  const goods = ['petroleum','explosives','machineparts','money'];
  let candidates = negAllCandidates(goods);
  const locked = new Array(5).fill(null);
  let turns = 0;

  while (turns < 10) {
    turns++;
    const guess = negBestGuess(candidates, goods, locked);
    assert.ok(Array.isArray(guess) && guess.length === 5, 'guess must be 5 elements');
    const fb = negFeedback(secret, guess);
    const allCorrect = fb.every(s => s === 'correct');
    if (allCorrect) break;
    // Update locked and filter.
    const slots = fb.map((state, slotId) => ({slotId, resourceId: guess[slotId], state}));
    for (const {slotId, state, resourceId} of slots) {
      if (state === 'correct') locked[slotId] = resourceId;
    }
    candidates = negFilter(candidates, guess, slots);
    assert.ok(candidates.length > 0, 'candidates must not be empty at turn ' + turns);
  }
  assert.ok(turns <= 3, 'solver should win in ≤ 3 turns, took ' + turns);
});

test('solver always wins within 5 turns for 4-good 5-slot puzzle (sampled secrets)', () => {
  const goods = ['petroleum','explosives','machineparts','money'];
  // Test a sample of secrets (not all 1024 to keep test fast).
  const samples = [
    ['petroleum','petroleum','petroleum','petroleum','petroleum'],
    ['money','money','money','money','money'],
    ['explosives','machineparts','petroleum','money','explosives'],
    ['money','petroleum','machineparts','explosives','money'],
    ['machineparts','explosives','money','petroleum','machineparts'],
  ];
  for (const secret of samples) {
    let candidates = negAllCandidates(goods);
    const locked = new Array(5).fill(null);
    let turns = 0;
    while (turns < 10) {
      turns++;
      const guess = negBestGuess(candidates, goods, locked);
      const fb = negFeedback(secret, guess);
      if (fb.every(s => s === 'correct')) break;
      const slots = fb.map((state, i) => ({slotId: i, resourceId: guess[i], state}));
      for (const {slotId, state, resourceId} of slots) if (state === 'correct') locked[slotId] = resourceId;
      candidates = negFilter(candidates, guess, slots);
    }
    assert.ok(turns <= 5, 'solver failed for secret ' + JSON.stringify(secret) + ' (turns=' + turns + ')');
  }
});

test('omitted slotId in interrupted HAR means slot zero, not an impossible result',()=>{
 const guess=['whaleoil','rubber','coke','asbestos','petroleum'];
 const goods=[...guess,'explosives'];
 const feedback=guess.map((resourceId,i)=>({...i?{slotId:i}:{},resourceId,state:'wrong_person'}));
 const filtered=negFilter(negAllCandidates(goods),guess,feedback);
 assert.ok(filtered.length>0);
 assert.deepEqual(JSON.parse(JSON.stringify(filtered)),JSON.parse(JSON.stringify(negFilter(negAllCandidates(goods),guess,feedback.map((s,i)=>({...s,slotId:i}))))));
 assert.ok(Array.isArray(negBestGuess(filtered,goods,new Array(5).fill(null))));
});
