// Tests de las reglas de Firestore. Se ejecutan contra el emulador local:
//   npm run test:rules
// (usa un proyecto "demo-", así que no necesita cuenta ni credenciales)
import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, limit, getDocs,
} from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rockchain',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'games/g1'), {
      gameCode: 'ABC123', status: 'waiting', hostId: 'alice', players: ['alice', 'bob'],
    });
    await setDoc(doc(db, 'games/g2'), {
      gameCode: 'ZZZ999', status: 'in_progress', hostId: 'carol', players: ['carol'],
    });
    await setDoc(doc(db, 'users/alice'), {
      userId: 'alice', userName: 'Alice', image: '',
      games: { g1: { rockCoins: 600, waste: 50, products: [], readyForNextRound: false } },
    });
    await setDoc(doc(db, 'market/g2'), { round: 1 });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

// --- users ---

test('unauthenticated users cannot read profiles', async () => {
  await assertFails(getDoc(doc(anon(), 'users/alice')));
});

test('a user can create their own profile without email', async () => {
  await assertSucceeds(setDoc(doc(as('dave'), 'users/dave'), {
    userId: 'dave', userName: 'Dave', image: '', games: {},
  }));
});

test('a profile cannot store the email or start with coins', async () => {
  await assertFails(setDoc(doc(as('dave'), 'users/dave'), {
    userId: 'dave', userName: 'Dave', image: '', games: {}, email: 'dave@example.com',
  }));
  await assertFails(setDoc(doc(as('dave'), 'users/dave'), {
    userId: 'dave', userName: 'Dave', image: '', games: { g1: { rockCoins: 1e9 } },
  }));
});

test('nobody can create a profile for someone else', async () => {
  await assertFails(setDoc(doc(as('mallory'), 'users/dave'), {
    userId: 'dave', userName: 'Dave', image: '', games: {},
  }));
});

test('a user can mark non-economic fields of their own game', async () => {
  await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), {
    'games.g1.readyForNextRound': true, lastGameId: 'g1',
  }));
  await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), {
    'games.g1.respondedProblems.b1': true, lastGameId: 'g1',
  }));
  await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), {
    'games.g1.selectedIndustry': 'Construction', lastGameId: 'g1',
  }));
});

test('a user cannot change their own balance, waste or products', async () => {
  await assertFails(updateDoc(doc(as('alice'), 'users/alice'), {
    'games.g1.rockCoins': 999999, lastGameId: 'g1',
  }));
  await assertFails(updateDoc(doc(as('alice'), 'users/alice'), {
    'games.g1.waste': 0, 'games.g1.readyForNextRound': true, lastGameId: 'g1',
  }));
  await assertFails(updateDoc(doc(as('alice'), 'users/alice'), {
    'games.g1.products': [{ id: 'free' }], lastGameId: 'g1',
  }));
  // Sin lastGameId tampoco
  await assertFails(updateDoc(doc(as('alice'), 'users/alice'), {
    'games.g1.rockCoins': 999999,
  }));
  // Ni declarando otra partida
  await assertFails(updateDoc(doc(as('alice'), 'users/alice'), {
    'games.g1.rockCoins': 999999, 'games.g9.readyForNextRound': true, lastGameId: 'g9',
  }));
});

test('a user can rename themselves but not edit other users', async () => {
  await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), { userName: 'Alicia' }));
  await assertFails(updateDoc(doc(as('bob'), 'users/alice'), { userName: 'pwned' }));
  await assertFails(deleteDoc(doc(as('bob'), 'users/alice')));
});

// --- games ---

test('clients cannot write games directly', async () => {
  await assertFails(setDoc(doc(as('alice'), 'games/new'), {
    hostId: 'alice', players: ['alice'], status: 'waiting',
  }));
  await assertFails(updateDoc(doc(as('alice'), 'games/g1'), { status: 'finished' }));
  await assertFails(deleteDoc(doc(as('alice'), 'games/g1')));
});

test('participants can read their game; outsiders only open games', async () => {
  await assertSucceeds(getDoc(doc(as('bob'), 'games/g1')));
  await assertSucceeds(getDoc(doc(as('mallory'), 'games/g1')));
  await assertFails(getDoc(doc(as('mallory'), 'games/g2')));
  await assertSucceeds(getDoc(doc(as('carol'), 'games/g2')));
});

test('join-by-code search only returns one open game', async () => {
  const games = collection(as('mallory'), 'games');
  await assertSucceeds(getDocs(query(games,
    where('gameCode', '==', 'ABC123'), where('status', '==', 'waiting'), limit(1))));
  // Listar todas las partidas o las que están en curso no está permitido
  await assertFails(getDocs(games));
  await assertFails(getDocs(query(games, where('status', '==', 'waiting'), limit(50))));
  await assertFails(getDocs(query(games, where('gameCode', '==', 'ZZZ999'), limit(1))));
});

// --- datos del servidor ---

test('market and blockchain are readable only by participants and never writable', async () => {
  await assertSucceeds(getDoc(doc(as('carol'), 'market/g2')));
  await assertFails(getDoc(doc(as('mallory'), 'market/g2')));
  await assertFails(setDoc(doc(as('carol'), 'market/g2'), { round: 99 }));
  await assertFails(setDoc(doc(as('carol'), 'blockchain/g2/blocks/b1'), { winner: 'carol' }));
});

test('unknown collections are denied', async () => {
  await assertFails(getDoc(doc(as('alice'), 'secrets/x')));
  await assertFails(setDoc(doc(as('alice'), 'secrets/x'), { a: 1 }));
});
