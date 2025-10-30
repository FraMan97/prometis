import NodeCache from "node-cache";
import { Message } from "../services/message";
import { SessionChannel } from "../services/session_channel";
import multer from "multer";
import express, { Application} from 'express';
import { SocksProxyAgent } from "socks-proxy-agent";
import { ChildProcess } from "child_process";
import path from 'path';


function getTorExecutableName(): string {
    switch (process.platform) {
        case 'win32':
            return 'tor.exe';
        case 'darwin':
        case 'linux':
        default:
            return 'tor';
    }
}

const torBundleDir = process.env.TOR_BUNDLE_DIR || 'tor/tor-bundle-default'; 

export let openedSessions: Map<string, SessionChannel> = new Map<string, SessionChannel>();

export let messagesQueue: Map<string, Array<Message>> = new Map<string, Array<Message>>();

export const fileCache = new NodeCache({ 
    stdTTL: 3600,           
    checkperiod: 120,       
    useClones: false        
});

export const upload = multer({ storage: multer.memoryStorage() });

const projectRoot = path.join(__dirname, '..', '..');

export class config {
  static port = Number(process.env.PEER_PORT);
  static discoveryServer = process.env.DISCOVERY_SERVER_URL || "localhost:3000";
  static onionAddress = process.env.PEER_URL || "localhost:3055";

  static torPath = path.join(projectRoot, torBundleDir, 'tor', getTorExecutableName());
  static torDataPath = path.join(projectRoot, torBundleDir, 'data', 'tor_data');
  static torHiddenServicePath = path.join(projectRoot, torBundleDir, 'data', 'hidden_service');
  
  static torSocksPort = Number(process.env.SOCK_PORT)
}

export const appLocal: Application = express();
export const proxyAddress = `socks5h://127.0.0.1:${String(config.torSocksPort)}`;
export const torAgent = new SocksProxyAgent(proxyAddress);

export let torProcess: ChildProcess | null = null;
export const setTorProcess = (process: ChildProcess) => {
    torProcess = process;
}