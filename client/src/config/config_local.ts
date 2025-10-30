import dotenv from 'dotenv';

dotenv.config();

interface Config {
    address: string;
    port: number;
    discoveryServer: string
}

const configLocal: Config = {
  address: process.env.LOCAL_PEER_URL || "localhost:3056",
  port: Number(process.env.LOCAL_PEER_PORT),
  discoveryServer: process.env.DISCOVERY_SERVER_URL || "localhost:3000"
};

export default configLocal;