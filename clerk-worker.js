/* Bureau of Small Tasks — the Clerk (module Web Worker).
   Runs a small sentence-embedding model entirely in the browser with Transformers.js,
   so the desk never freezes and no task text ever leaves the device.

   Filing is prototype-based: each department has a few example sentences. A new task is
   embedded and filed under the department whose closest example it most resembles
   (cosine similarity). The same embedding is sent back for the duplicate check. */

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false; // fetch the model from the Hub…
env.useBrowserCache = true;   // …once: afterwards it is served from the browser's Cache Storage

const MODEL = 'Xenova/all-MiniLM-L6-v2';

const PROTOTYPES = {
  correspondence: [
    'reply to an email',
    'answer a message from someone',
    'phone someone to return their call',
    'send a letter or a text message',
    'follow up with a person who has not answered',
  ],
  errands: [
    'buy groceries at the shop',
    'do the laundry and clean the house',
    'pick up a parcel from the post office',
    'household chores and tidying up',
    'take something to be repaired or returned',
  ],
  study: [
    'study for an exam',
    'read a chapter of a book',
    'take an online course and learn a new skill',
    'finish homework or an assignment',
    'revise lecture notes',
  ],
  treasury: [
    'pay a bill',
    'transfer money between bank accounts',
    'sort out taxes and the budget',
    'check the bank account and expenses',
    'renew insurance or cancel a subscription',
  ],
  wellbeing: [
    'go for a run or to the gym',
    'exercise, stretch or do yoga',
    'book a doctor or dentist check-up',
    'rest, sleep early and take a break',
    'meditate and drink more water',
  ],
  meetings: [
    'attend a meeting',
    'daily standup with the team',
    'a scheduled video call',
    'prepare for a job interview',
    'one to one catch-up with a manager',
  ],
  creative: [
    'work on a side project',
    'write a blog post or a story',
    'build an app or a website',
    'draw, design or paint something',
    'record music or edit a video',
  ],
};

let extractor = null;
let protoVecs = null; // { dept: number[][] }

async function embed(texts) {
  const out = await extractor(texts, { pooling: 'mean', normalize: true });
  return out.tolist();
}

// vectors are normalised, so the dot product is the cosine similarity
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function classify(vec) {
  let best = { dept: 'errands', score: -1 };
  for (const dept of Object.keys(protoVecs)) {
    let top = -1;
    for (const proto of protoVecs[dept]) top = Math.max(top, dot(vec, proto));
    if (top > best.score) best = { dept, score: top };
  }
  return best;
}

const ready = (async () => {
  extractor = await pipeline('feature-extraction', MODEL, { quantized: true });
  protoVecs = {};
  for (const dept of Object.keys(PROTOTYPES)) protoVecs[dept] = await embed(PROTOTYPES[dept]);
  self.postMessage({ type: 'ready' });
})();

ready.catch((err) => self.postMessage({ type: 'error', message: String((err && err.message) || err) }));

self.onmessage = async (e) => {
  const msg = e.data;
  if (!msg || msg.type !== 'file') return;
  try {
    await ready;
    const items = msg.items || [];
    for (let i = 0; i < items.length; i += 16) {
      const chunk = items.slice(i, i + 16);
      const vecs = await embed(chunk.map((it) => it.text));
      chunk.forEach((it, k) => {
        const { dept, score } = classify(vecs[k]);
        self.postMessage({ type: 'filed', id: it.id, dept, score, vec: vecs[k] });
      });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err && err.message) || err) });
  }
};
