import express, { Application, Request, Response } from 'express';
import { ActiveNodesQueryParam, ActiveNodesQueryParamSchema, PeerNode, SubscriptionBody, SubscriptionSchema, UnSubscriptionBody, UnSubscriptionSchema} from './models/model.js';
import config from './config/config.js';
import cors from 'cors';
import { validateActiveNodes, validateSubscription } from './services/validation.js';
import { verifySignature } from './services/common.js';
import { activePeersCache, activePeersLimiter, subscriptionLimiter } from './models/global.js';
import { spawn } from 'child_process';
import { chmodSync, mkdirSync, readFileSync, rmSync } from 'fs';
import path from 'path';

const TOR_PATH = config.torPath;
const DATA_DIR = config.torDataPath;
const HIDDEN_SERVICE_DIR = config.torHiddenServicePath;
const HOSTNAME_PATH = path.join(HIDDEN_SERVICE_DIR, 'hostname');
const SOCKS_PORT = (config.torSocksPort || '9050').toString();
const HIDDEN_SERVICE_PORT_CONFIG = `${config.port} 127.0.0.1:${config.port}`;

let appStarted = false;
let currentOnionAddress = '';

const app: Application = express();

app.use(cors({
    origin: '*',
    methods: 'GET,POST',
}));

app.use(express.json());

app.post("/subscribe", validateSubscription(SubscriptionSchema), subscriptionLimiter, (req: Request<{}, {}, SubscriptionBody, {}>, res: Response) => {
    const { address, nickname, publicKey: publicKey } = req.body;

    console.log(`Received a subscribe request`, req.body);
    const success = activePeersCache.set(address, {
        address: address,
        nickname: nickname,
        publicKey: publicKey,
        date: new Date()
    }, config.ttlActivePeers);

    if (success) {
        console.log(`Active peer ${address} inserted into cache.`);
        res.status(200).send({ "message": `Active peer ${address} inserted`, "status": 200 });
    } else {
         console.error(`Failed to insert active peer ${address} into cache.`);
         res.status(500).send({ "error": `Active peer ${address} not inserted`, "status": 500 });
    }
});

app.post("/unsubscribe", validateSubscription(UnSubscriptionSchema), subscriptionLimiter, (req: Request<{}, {}, UnSubscriptionBody, {}>, res: Response) => {
    const { address, signature } = req.body;

    console.log(`Received an unsubscribe request for`, address);
    const peerData = activePeersCache.get<any>(address);

    if (!peerData) {
        console.log(`Peer not found in registry for unsubscribe: ${address}`);
        return res.status(404).send({ "error": `Peer not exist in the registry`, "status": 404 });
    }

    const header = '-----BEGIN PUBLIC KEY-----';
    const footer = '-----END PUBLIC KEY-----';
    const rawPublicKey = typeof peerData.publicKey === 'string' ? peerData.publicKey : '';
    const strippedKey = rawPublicKey.replace(/\s/g, '');
    let pemBody = strippedKey
        .replace(header.replace(/\s/g, ''), '')
        .replace(footer.replace(/\s/g, ''), '');
    const formattedPublicKey = `${header}\n${pemBody}\n${footer}`;
    console.log(formattedPublicKey);
    if (!verifySignature(address, signature, formattedPublicKey)) {
        console.log("Sender not verified for unsubscribe");
        return res.status(403).send({ "error": `Sender not verified`, "status": 403 });
    }

    const deletedCount = activePeersCache.del(address);
    if (deletedCount > 0) {
        console.log(`Peer ${address} unsubscribed and removed from cache.`);
        res.status(200).send({ "message": `Peer ${address} unsubscribed`, "status": 200 });
    } else {
        console.error(`Failed to delete peer ${address} from cache even after verification.`);
        res.status(500).send({ "error": `Failed to remove peer from registry`, "status": 500 });
    }
});

app.get("/active-peers", validateActiveNodes(ActiveNodesQueryParamSchema), activePeersLimiter, (req: Request<{}, {}, {}, ActiveNodesQueryParam>, res: Response) => {
    const requestedAddress = req.query.address;
    console.log("Received a request for active peers list", requestedAddress ? `(filtered by ${requestedAddress})` : '');

    if (requestedAddress) {
        const peerData = activePeersCache.get<any>(requestedAddress);
        const responsePeers = peerData ? [peerData] : [];
        res.status(200).send({
            "activePeers": responsePeers,
            "status": 200
        });
    } else {
        const allKeys = activePeersCache.keys();
        const activePeersList = allKeys.map(key => activePeersCache.get<any>(key)).filter(Boolean);

        const responsePayload = {
            "activePeers": activePeersList,
            "status": 200
        };
        console.log(`Returning ${activePeersList.length} active peers.`);
        res.status(200).send(responsePayload);
    }
});

function startAppServer(onionAddress: string) {
    if (appStarted) return;
    appStarted = true;
    currentOnionAddress = onionAddress;

    console.log('Tor is ready. Starting Express server...');

    app.listen(config.port, () => {
        console.log(`Discovery server listening on http://${onionAddress}:${config.port}`);
    });
}

try {

  console.log(`Checking Tor directories...`);
  rmSync(HIDDEN_SERVICE_DIR, { recursive: true, force: true });
  console.log('Old hidden service directory removed.');
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(HIDDEN_SERVICE_DIR, { recursive: true });
  if (process.platform !== 'win32') {
    chmodSync(DATA_DIR, 0o700);
    chmodSync(HIDDEN_SERVICE_DIR, 0o700);
  }
  
  console.log('Tor directories ensured.');
} catch (err) {
  console.error('Error managing Tor directories:', err);
  process.exit(1);
}

console.log('Starting Tor with command-line configuration...');

const torArgs = [
    '--DataDirectory', DATA_DIR,
    '--HiddenServiceDir', HIDDEN_SERVICE_DIR,
    '--HiddenServicePort', HIDDEN_SERVICE_PORT_CONFIG,
    '--SocksPort', SOCKS_PORT,
];

const tor = spawn(TOR_PATH, torArgs);

tor.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`[Tor] ${output.trim()}`);

  if (output.includes('Bootstrapped 100%') && !appStarted) {
    setTimeout(() => {
      try {
        const onionAddress = readFileSync(HOSTNAME_PATH, 'utf-8').trim();
        startAppServer(onionAddress);
      } catch (err) {
        console.error('Error reading onion address:', err);
        tor.kill();
        process.exit(1);
      }
    }, 1000);
  }
});

tor.stderr.on('data', (data) => {
  const errorMsg = data.toString().trim();
  console.error(`[Tor Error] ${errorMsg}`);
  if (errorMsg.includes('Reading config failed')) {
      console.error('Tor failed to start. Exiting.');
      process.exit(1);
  }
});

process.on('SIGINT', () => {
  console.log('\nStopping Tor...');
  tor.kill();
  process.exit(0);
});