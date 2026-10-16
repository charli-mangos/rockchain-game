# RockChain

RockChain is a multiplayer educational mobile game about the economy of the natural stone sector and the basics of blockchain. It was developed as part of an Erasmus+ project.

Players compete in short rounds. They trade marble blocks and slabs on a shared market, turn blocks into higher-value slabs, manage the waste their activity produces, and "mine" the blocks of a shared chain by solving small problems before the other players. Mining each block confirms the transactions behind it. The aim is to understand, through play, how a market of raw materials works, why waste and recycling matter, and what mining and blocks mean in a blockchain.

> **Status:** archived research and education project. The code is published as a portfolio piece and is not actively maintained.

## Features

- **Rooms:** 2–5 players create or join a room with a short code; each game has three rounds of 120 seconds.
- **Market:** five marble types (Red, White, Gray, Black, Cream) in three qualities (A, B, C), sold as blocks or slabs. Prices are generated per round by the server.
- **Trading:** you can buy, sell and transform products (block → slab) with *RockCoins*. Every operation produces waste.
- **Mining:** each transaction creates a block with a problem; the first correct answer mines the block and earns a reward.
- **Recycling:** you can bet on the winning industry of the round to reduce your waste.
- **Results:** rankings, end-of-round summaries, statistics and an educational tutorial.
- **Languages:** the app is available in English, Spanish, German, Croatian and Romanian.

## Architecture

```
┌──────────────────────────┐   Firebase Auth (email/password)
│  Mobile app              │──────────────────────────────────────┐
│  Expo / React Native     │   Firestore (read-only game state)    │
│  src/, App.js            │──────────────────────────────┐        │
└───────────┬──────────────┘                              │        │
            │ Socket.IO (ID token in the handshake)       │        │
            ▼                                             ▼        ▼
┌──────────────────────────┐  Firebase Admin   ┌──────────────────────────┐
│  Real-time game server   │──────────────────▶│  Firebase                │
│  Node.js + Socket.IO     │                   │  Firestore + Auth        │
│  server/ (Cloud Run)     │                   │  Cloud Functions         │
└──────────────────────────┘                   │  functions/              │
                                               └──────────────────────────┘
```

| Part | Tech | Role |
|---|---|---|
| `src/`, `App.js` | Expo SDK 53, React Native 0.79, React Navigation, i18next | Mobile client (Android/iOS) |
| `server/` | Node.js 22, Express 5, Socket.IO 4 | Authoritative real-time game loop: rooms, round timers, market, transactions, mining. Deployed on Google Cloud Run |
| `functions/` | Firebase Cloud Functions v2 | Callable functions for the game lifecycle: create, join, start, end rounds, leave, profile |
| `firestore.rules` | Firestore Security Rules | Clients can only read their games and edit non-economic fields; all economic state is written server-side |

### Security model

- Every Socket.IO connection must present a Firebase ID token. The server uses the verified uid and never a `userId` sent by the client.
- Prices, waste and inventories are computed on the server.
- Every callable Cloud Function requires authentication and checks the caller's role (host or player).
- The Firestore rules are covered by emulator tests (`tests/firestore.rules.test.mjs`).

## Running it with your own Firebase project

You need Node.js 22, a Firebase project of your own (the free *Spark* plan is enough for Auth and Firestore; Cloud Functions require *Blaze*), and the Firebase CLI (`npm i -g firebase-tools`).

1. **Create a Firebase project.**
   - In the Firebase Console, enable **Authentication → Email/Password** and create a **Firestore** database.
   - Register an Android app (package `com.uerasmus.rockchain`) and/or an iOS app with the same bundle id.
2. **Configure the app.**
   ```bash
   npm ci --ignore-scripts
   cp .env.example .env                     # fill in your EXPO_PUBLIC_FIREBASE_* values
   cp .firebaserc.example .firebaserc       # set your project id
   cp google-services.json.example google-services.json            # or download yours from the console
   cp GoogleService-Info.plist.example GoogleService-Info.plist    # idem, for iOS
   ```
3. **Deploy the rules and the functions** to *your* project.
   ```bash
   (cd functions && npm ci --ignore-scripts)
   firebase deploy --only firestore:rules,firestore:indexes,functions
   ```
4. **Run the game server locally.** It uses Application Default Credentials, e.g. `gcloud auth application-default login`, or `GOOGLE_APPLICATION_CREDENTIALS` pointing to a key file stored **outside** the repository.
   ```bash
   cd server && npm ci --ignore-scripts
   FIREBASE_PROJECT_ID=<your-project-id> PORT=3001 npm start
   ```
5. **Start the app.** On a physical device, set `EXPO_PUBLIC_WEBSOCKET_URL=ws://<your-computer-ip>:3001` in `.env`.
   ```bash
   npx expo start            # or ./dev-start.sh --local to start the server too
   ```

To deploy the server to Cloud Run:
```bash
FIREBASE_PROJECT_ID=<id> CORS_ORIGINS= ./server/deploy.sh
```
Game state lives in memory, so the service runs on a single instance.

### Tests

```bash
npm test             # Cloud Functions and socket-server unit tests (node:test)
npm run test:rules   # Firestore rules against the local emulator (needs Java + firebase-tools)
```

The `security` GitHub Actions workflow runs gitleaks, `npm audit` and the unit tests.

## My role

<!-- TODO(Charli): describe your role -->

## Credits and project context

<!-- TODO(Charli): pending confirmation with CTM — project name, Erasmus+ reference,
     partners, funding acknowledgement and logos, as required by the grant agreement. -->

RockChain was developed at CTM (Centro Tecnológico del Mármol) within an Erasmus+ project. *Details pending confirmation.*

## License

**Pending.** No license has been chosen yet. Until one is added, all rights are reserved by the copyright holders.
