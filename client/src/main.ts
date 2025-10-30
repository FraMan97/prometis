import configLocal from './config/config_local';
import { KeyPairManager } from './services/key_manager';
import { app } from './views/api';
import { appLocal } from './views/api_local';
import { spawn } from 'child_process';
import { chmodSync, mkdirSync, readFileSync, rmSync } from 'fs';
import path from 'path';
import { config, setTorProcess } from './models/global';
import open from 'open';

const TOR_PATH = config.torPath;
const DATA_DIR = config.torDataPath;
const HIDDEN_SERVICE_DIR = config.torHiddenServicePath;
const HOSTNAME_PATH = path.join(HIDDEN_SERVICE_DIR, 'hostname');
const SOCKS_PORT = (config.torSocksPort || '9050').toString();
const HIDDEN_SERVICE_PORT_CONFIG = `${config.port} 127.0.0.1:${config.port}`;

let appStarted = false;


function startApp(onionAddress: string) {
  config.onionAddress = onionAddress + ":" + config.port;
  if (appStarted) return;
  appStarted = true;

  console.log('Tor is ready. Starting peer...');

  KeyPairManager.getInstance();

  app.listen(config.port, () => {
    console.log(`Onion peer reachable at: http://${onionAddress}:${config.port}`);
  });

  appLocal.listen(configLocal.port, async () => {
    const url = `http://${configLocal.address}`;
    console.log(`Local peer listening on http://localhost:${configLocal.port}`);
    
    try 
    {
      await open(url);
    } 
    catch (error: any) 
    {
      console.warn(`Could not open browser: ${error.message}`);
    }
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

setTorProcess(tor);

tor.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`[Tor] ${output.trim()}`);

  if (output.includes('Bootstrapped 100%') && !appStarted) {
    setTimeout(() => {
      try {
        const onionAddress = readFileSync(HOSTNAME_PATH, 'utf-8').trim();

        startApp(onionAddress);

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