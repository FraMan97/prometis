import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function getTorExecutableName(): string {
    switch (process.platform) {
        case 'win32':
            return 'tor.exe';
        default:
            return 'tor';
    }
}

const torBundleDir = process.env.TOR_BUNDLE_DIR || 'tor/tor-bundle-default';

const projectRoot = path.join(__dirname, '..', '..');

interface Config {
  port: number;
  address: string,
  ttlActivePeers: number,
  torPath: string;
  torDataPath: string;
  torHiddenServicePath: string;
  torSocksPort: number
}

const config: Config = {
  port: Number(process.env.SERVER_PORT),
  address: process.env.SERVER_URL || "localhost:3000",
  ttlActivePeers: Number(process.env.TTL_ACTIVE_PEERS),
  
  torPath: path.join(projectRoot, torBundleDir, 'tor', getTorExecutableName()),
  torDataPath: path.join(projectRoot, torBundleDir, 'data', 'tor_data'),
  torHiddenServicePath: path.join(projectRoot, torBundleDir, 'data', 'hidden_service'),
  
  torSocksPort: Number(process.env.SOCK_PORT)
};

export default config;