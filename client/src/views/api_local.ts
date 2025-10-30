import express, { Request, Response } from 'express';
import { SessionChannel } from '../services/session_channel';
import { ActiveNodesQueryTestParam, ActiveNodesQueryParamTestSchema, CloseSessionTestBody, CloseSessionTestSchema, DownloadFileTestBody, DownloadFileTestSchema, GetMessagesQueryTestSchema, SendMessageTestBody, SendMessageTestSchema, StartSessionTestBody, StartSessionTestSchema, UploadFileTestBody, SubscriptionTestBody, SubscriptionTestSchema, UnSubscriptionTestBody, UnSubscriptionTestSchema } from '../models/model_local';
import { KeyPairManager } from '../services/key_manager';
import cors from 'cors';
import { validateActiveNodes, validateCloseSession, validateDownloadFile, validateSendMessage, validateStartSession, validateSubscription } from '../services/validation';
import { appLocal, config, fileCache, messagesQueue, openedSessions, upload, torAgent, torProcess } from '../models/global';
import axios from 'axios';
import { Message } from '../services/message';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import configLocal from '../config/config_local';


appLocal.use(cors({
    origin: '*',
    methods: 'GET,POST',
}));

appLocal.use(express.json());
const isPkg = typeof (process as any).pkg !== 'undefined';

const basePath = isPkg
    ? process.cwd()
    : path.join(__dirname, '..', '..');

const frontendPath = path.join(basePath, 'local');

appLocal.use(express.static(frontendPath));

appLocal.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

appLocal.get("/local/active-peers", validateActiveNodes(ActiveNodesQueryParamTestSchema), async (req: Request<{}, {}, {}, ActiveNodesQueryTestParam>, res: Response) => {
    const requestedAddress = req.query.address;
    console.log("Received a request for active peers list", requestedAddress ? `(filtered by ${requestedAddress})` : '');
    try {
        const targetUrl = new URL(`http://${configLocal.discoveryServer}/active-peers`);
        if (requestedAddress) {
            targetUrl.searchParams.append("address", requestedAddress);
        }

        const response = await axios.get(targetUrl.toString(), {
            httpAgent: torAgent,
            httpsAgent: torAgent
        });

        const data = response.data as { activePeers: string[any] } | null;
        res.status(200).send({
            "activePeers": data?.activePeers || [],
            "status": 200
        });

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            const errorMessage = error.response.data;
            console.error(`Error from discovery server (${configLocal.discoveryServer}): ${error.response.status} - ${JSON.stringify(errorMessage)}`);
            res.status(error.response.status).send({ "error": `Failed to get active peers`, "details": errorMessage, "status": error.response.status });
        } else {
            console.error("Discovery server is unreachable", error);
            res.status(503).send({ "error": "Discovery server is unreachable", "status": 503 });
        }
    }
});

appLocal.post("/local/shutdown", async (req: Request, res: Response) => {
    console.log("Shutdown requested");
    res.status(200).send({ "message": "Peer shutting down...", "status": 200 });

    const addressToUnsubscribe = `${config.onionAddress}`;
    const signature = KeyPairManager.getInstance().sign(addressToUnsubscribe);
    try {
        const payload = { address: addressToUnsubscribe, signature: signature };

        const response = await axios.post(`http://${configLocal.discoveryServer}/unsubscribe`, payload, {
            httpAgent: torAgent,
            httpsAgent: torAgent,
            headers: { 'Content-Type': 'application/json' }
        });

        console.log("Unsubscribed from discovery server during reset");

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            const errorMessage = error.response.data;
            console.error(`Error unsubscribing during shutdown from ${configLocal.discoveryServer}: ${error.response.status} - ${JSON.stringify(errorMessage)}`);
        } else {
            console.error("Discovery server unreachable during shutdown", error);
        }
    }

    setTimeout(() => {
        console.log("Shutting down server...");
        process.exit(0);
    }, 1000);

    if (torProcess) {
        console.log("Stopping Tor process...");
        torProcess.kill();
        console.log("Tor process stopped.");
    } else {
        console.log("Tor process instance not found.");
    }
});

appLocal.post("/local/unsubscribe", validateSubscription(UnSubscriptionTestSchema), async (req: Request<{}, {}, UnSubscriptionTestBody, {}>, res: Response) => {
    const addressToSign = req.body.address;
    const signature = KeyPairManager.getInstance().sign(addressToSign);
    try {
        const payload = { address: addressToSign, signature: signature };
        console.log(addressToSign);
        console.log(signature);
        const response = await axios.post(`http://${configLocal.discoveryServer}/unsubscribe`, payload, {
            httpAgent: torAgent,
            httpsAgent: torAgent,
            headers: { 'Content-Type': 'application/json' }
        });

        console.log("Unsubscribed with discovery server");
        res.status(200).send({ "message": "Unsubscribed successfully", "status": 200 });

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            const errorMessage = error.response.data;
            console.error(`Error from discovery server (${configLocal.discoveryServer}): ${error.response.status} - ${JSON.stringify(errorMessage)}`);
            res.status(error.response.status).send({ "error": `Failed to unsubscribe`, "details": errorMessage, "status": error.response.status });
        } else {
            console.error("Discovery server is unreachable", error);
            res.status(503).send({ "error": "Discovery server is unreachable", "status": 503 });
        }
    }
});

appLocal.post("/local/subscribe", validateSubscription(SubscriptionTestSchema), async (req: Request<{}, {}, SubscriptionTestBody, {}>, res: Response) => {
    const address = req.body.address;
    const nickname = req.body.nickname;
    const publicKey = req.body.publicKey;
    try {
        const payload = { address: address, nickname: nickname, publicKey: publicKey };

        const response = await axios.post(`http://${configLocal.discoveryServer}/subscribe`, payload, {
            httpAgent: torAgent,
            httpsAgent: torAgent,
            headers: { 'Content-Type': 'application/json' }
        });

        console.log("Subscribed with discovery server");
        res.status(200).send({ "message": "Subscribed successfully", "status": 200 });

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            const errorMessage = error.response.data;
            console.error(`Error from discovery server (${configLocal.discoveryServer}): ${error.response.status} - ${JSON.stringify(errorMessage)}`);
            res.status(error.response.status).send({ "error": `Failed to subscribe`, "details": errorMessage, "status": error.response.status });
        } else {
            console.error("Discovery server is unreachable", error);
            res.status(503).send({ "error": "Discovery server is unreachable", "status": 503 });
        }
    }
});


appLocal.post("/local/reset", async (req: Request<{}, {}, {}, {}>, res: Response) => {
    console.log("Reset keys");
    const addressToUnsubscribe = `${config.onionAddress}`;
    const signature = KeyPairManager.getInstance().sign(addressToUnsubscribe);
    try {
        const payload = { address: addressToUnsubscribe, signature: signature };

        const response = await axios.post(`http://${configLocal.discoveryServer}/unsubscribe`, payload, {
            httpAgent: torAgent,
            httpsAgent: torAgent,
            headers: { 'Content-Type': 'application/json' }
        });

        console.log("Unsubscribed from discovery server during reset");

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            const errorMessage = error.response.data;
            console.error(`Error unsubscribing during reset from ${configLocal.discoveryServer}: ${error.response.status} - ${JSON.stringify(errorMessage)}`);
        } else {
            console.error("Discovery server unreachable during reset", error);
        }
    }

    KeyPairManager.getInstance().resetInstance();
    messagesQueue.clear();
    openedSessions.clear();
    fileCache.flushAll();
    console.log("Local state reset");
    res.status(200).send({ "message": "Reset keys and local state", "status": 200 });
});


appLocal.get("/local/configurations", (req: Request<{}, {}, {}, {}>, res: Response) => {
    console.log("Requested internal configurations");
    const fullAddress = `${config.onionAddress}`;
    res.status(200).send({
        "message": {
            "onionAddress": fullAddress,
            "publicKey": KeyPairManager.getInstance().getPublicKey(),
            "discoveryServerUrl": configLocal.discoveryServer,
            "localPeer": configLocal.address
        },
        "status": 200
    });
});


appLocal.post("/local/start-session", validateStartSession(StartSessionTestSchema), async (req: Request<{}, {}, StartSessionTestBody, {}>, res: Response) => {
    const body = req.body;
    const senderAddress = body.senderAddress;
    const senderNickname = body.senderNickname;
    const senderPublicKey = body.senderPublicKey;
    const destinationNickname = body.destinationNickname;
    const destinationPublicKey = body.destinationPublicKey;
    const destinationAddress = body.destinationAddress;

    if (openedSessions.has(destinationAddress)) {
        console.log(`Session already exists with: ${destinationAddress}`);
        return res.status(200).send({ "message": `Session already active with ${destinationAddress}`, "status": 200 });
    }


    let sessionChannel = new SessionChannel(destinationPublicKey, destinationNickname);
    const sessionInitData = {
        senderAddress: senderAddress,
        senderPublicKey: senderPublicKey,
        senderNickname: senderNickname,
        encryptedSessionKey: sessionChannel.getEncryptedSessionKey().toString("base64")
    }
    const signature = KeyPairManager.getInstance().sign(JSON.stringify(sessionInitData));
    console.log(JSON.stringify(sessionInitData));
    console.log(signature);
    (sessionInitData as any).signature = signature;

    try {
        const response = await axios.post(`http://${destinationAddress}/api/start-session`, sessionInitData, {
            httpAgent: torAgent,
            httpsAgent: torAgent,
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`Session established with: `, destinationAddress);
        openedSessions.set(destinationAddress, sessionChannel);
        if (!messagesQueue.has(destinationAddress)) {
            messagesQueue.set(destinationAddress, []);
        }
        res.status(200).send({ "message": `Session established with ${destinationAddress}`, "status": 200 });

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            const errorMessage = error.response.data;
            console.error(`Error from destination peer (${destinationAddress}): ${error.response.status} - ${JSON.stringify(errorMessage)}`);
            res.status(error.response.status).send({
                "error": `Failed to initiate session on destination peer`,
                "details": errorMessage,
                "status": error.response.status
            });
        } else {
            console.error(`Network or Internal Error when starting session with ${destinationAddress}: `, error);
            res.status(503).send({
                "error": `Network Error: Cannot connect to destination peer ${destinationAddress}. Is it running?`,
                "status": 503
            });
        }
    }
});


appLocal.post("/local/close-session", validateCloseSession(CloseSessionTestSchema), async (req: Request<{}, {}, CloseSessionTestBody, {}>, res: Response) => {
    const body = req.body;
    const destinationAddress = body.destinationAddress;
    const senderAddress = body.senderAddress;

    const sessionChannel = openedSessions.get(destinationAddress);

    if (!sessionChannel) {
        console.log("Session doesn't exist with ", destinationAddress);
        return res.status(200).send({ "message": `Session already closed or never existed with ${destinationAddress}`, "status": 200 });
    }

    const signature = KeyPairManager.getInstance().sign(senderAddress);

    try {
        const payload = { senderAddress: senderAddress, signature: signature };

        const response = await axios.post(`http://${destinationAddress}/api/close-session`, payload, {
            httpAgent: torAgent,
            httpsAgent: torAgent,
            headers: { 'Content-Type': 'application/json' }
        });

        openedSessions.delete(destinationAddress);
        messagesQueue.delete(destinationAddress);
        console.log(`Locally closed session with: `, destinationAddress);

        console.log(`Remote peer confirmed session close with: `, destinationAddress);
        res.status(200).send({ "message": `Session closed successfully with ${destinationAddress}`, "status": 200 });

    } catch (error) {
        openedSessions.delete(destinationAddress);
        messagesQueue.delete(destinationAddress);
        console.log(`Locally closed session with peer (request failed): `, destinationAddress);

        if (axios.isAxiosError(error) && error.response) {
            const errorMessage = error.response.data;
            console.error(`Error from destination peer during close (${destinationAddress}): ${error.response.status} - ${JSON.stringify(errorMessage)}`);
            res.status(207).send({
                "message": `Session closed locally, but failed to confirm closure on remote peer ${destinationAddress}.`,
                "details": errorMessage,
                "status": 207
            });
        } else {
            console.error(`Network Error when closing session with ${destinationAddress}: `, error);
            res.status(207).send({
                "message": `Session closed locally, but network error occurred contacting remote peer ${destinationAddress}.`,
                "error": `Network Error: Cannot connect to destination peer.`,
                "status": 207
            });
        }
    }
});


appLocal.post("/local/send-message", validateSendMessage(SendMessageTestSchema), async (req: Request<{}, {}, SendMessageTestBody, {}>, res: Response) => {
    const body = req.body;
    const destinationAddress = body.destinationAddress;
    const message = body.message;
    const senderAddress = body.senderAddress;

    const sessionChannel = openedSessions.get(destinationAddress);

    if (!sessionChannel) {
        console.log("Session doesn't exist with ", destinationAddress);
        return res.status(400).send({ "error": `Session doesn't exist with ${destinationAddress}. Cannot send message.`, "status": 400 });
    }

    try {
        const { encryptedData, iv } = sessionChannel.encryptMessage(message);

        const messagePayload = {
            encryptedMessage: encryptedData,
            iv: iv,
            senderAddress: senderAddress
        };

        const signature = KeyPairManager.getInstance().sign(JSON.stringify(messagePayload));
        (messagePayload as any).signature = signature;

        const response = await axios.post(`http://${destinationAddress}/api/send-message`, messagePayload, {
            httpAgent: torAgent,
            httpsAgent: torAgent,
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`Sent message "${message}" to ${destinationAddress}`);
        let messages = messagesQueue.get(destinationAddress);
        if (!messages) {
            messages = [];
            messagesQueue.set(destinationAddress, messages);
        }
        messages.push(new Message(senderAddress, message));

        return res.status(200).send({ "message": `Message sent to ${destinationAddress}`, "status": 200 });

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            const errorMessage = error.response.data;
            console.error(`Error from destination peer (${destinationAddress}) sending message: ${error.response.status} - ${JSON.stringify(errorMessage)}`);
            return res.status(error.response.status).send({
                "error": `Failed to send message to destination peer`,
                "details": errorMessage,
                "status": error.response.status
            });
        } else {
            console.error(`Encryption or Network Error when sending message to ${destinationAddress}: `, error);
            return res.status(500).send({
                "error": `Internal Error: Encryption failed or Network connection error sending to ${destinationAddress}.`,
                "status": 500
            });
        }
    }
});

appLocal.get("/local/get-messages", (req: Request<{}, {}, {}, GetMessagesQueryTestSchema>, res: Response) => {
    const query = req.query;
    const destinationAddress = query.destinationAddress;

    if (!destinationAddress) {
        return res.status(400).send({ "error": "Missing 'destinationAddress' query parameter", "status": 400 });
    }

    console.log(`Getting messages for session with ${destinationAddress}`);

    const sessionChannel = openedSessions.get(destinationAddress);
    if (!sessionChannel) {
        console.log(`No active session found for ${destinationAddress}`);
        return res.status(404).send({ "error": `No active session found with ${destinationAddress}`, "status": 404 });
    }

    const messages = messagesQueue.get(destinationAddress);

    return res.status(200).json(messages || []);
});


appLocal.post("/local/files", upload.single("file"), (req: Request<{}, {}, UploadFileTestBody, {}>, res: Response) => {
    if (!req.file) {
        return res.status(400).send({ "error": 'No file found in request' });
    }

    let ttl: number = 1800;
    const requestedTtl = Number(req.body.ttl);
    if (!isNaN(requestedTtl) && requestedTtl > 0) {
        ttl = Math.min(requestedTtl, 86400);
    }

    const fileId = uuidv4();

    const success = fileCache.set(fileId, {
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        date: new Date()
    }, ttl);

    if (!success) {
        console.error("Error while saving file to cache");
        return res.status(500).send({ "message": "Failed to save the file in cache", "status": 500 });
    }

    console.log(`File "${req.file.originalname}" saved in cache with ID: ${fileId}, TTL: ${ttl}s`);
    return res.status(200).send({ "fileId": fileId, "fileName": req.file.originalname, "status": 200 });
});

appLocal.get("/local/files", (req: Request<{}, {}, {}, {}>, res: Response) => {
    const fileIds = fileCache.keys();
    console.log("Requested file IDs: ", fileIds);
    return res.status(200).send({ "fileIds": fileIds, "status": 200 });
});

appLocal.delete("/local/files/:fileId", (req: Request, res: Response) => {
    const fileId = req.params.fileId;
    if (!fileId) {
        return res.status(400).send({
            "error": 'fileId parameter is missing',
            "status": 400
        });
    }
    try {
        const fileData = fileCache.get<any>(fileId);

        if (!fileData) {
            console.log(`Attempted to delete non-existent or expired file: ${fileId}`);
            return res.status(404).send({
                "error": 'File not found or already expired',
                "status": 404
            });
        }

        const deletedCount = fileCache.del(fileId);

        if (deletedCount > 0) {
            console.log(`File deleted: ${fileId}`);
            return res.status(200).send({
                "message": 'File deleted successfully',
                "status": 200
            });
        } else {
            console.error(`Failed to delete file from cache even though it was found: ${fileId}`);
            return res.status(500).send({
                "error": 'Failed to delete file from cache',
                "status": 500
            });
        }

    } catch (error) {
        console.error(`Error deleting file ${fileId}:`, error);
        return res.status(500).send({
            "error": 'Internal server error during file deletion',
            "status": 500
        });
    }
});

appLocal.post("/local/download-file", validateDownloadFile(DownloadFileTestSchema), async (req: Request<{}, {}, DownloadFileTestBody, {}>, res: Response) => {
    const fileId = req.body.fileId;
    const destinationAddress = req.body.destinationAddress;
    const downloadPath = req.body.downloadPath;

    if (!downloadPath || typeof downloadPath !== 'string' || downloadPath.trim() === '') {
        return res.status(400).send({ error: "Invalid or missing download path", status: 400 });
    }


    try {
        const response = await axios.post(`http://${destinationAddress}/api/download-file`, { fileId: fileId }, {
            httpAgent: torAgent,
            httpsAgent: torAgent,
            headers: { 'Content-Type': 'application/json' },
            responseType: 'arraybuffer'
        });

        const contentDisposition = response.headers['content-disposition'];
        let filename = `downloaded_file_${fileId}`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
            if (filenameMatch && filenameMatch[1]) {
                filename = path.basename(filenameMatch[1]);
            }
        }

        const buffer = Buffer.from(response.data);

        const fs = require('fs');
        const fullPath = path.join(downloadPath, filename);

        try {
            const directory = path.dirname(fullPath);
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }
            fs.writeFileSync(fullPath, buffer);

            console.log(`File ${fileId} downloaded successfully to ${fullPath}`);
            return res.status(200).send({
                message: "File downloaded successfully",
                path: fullPath,
                filename: filename,
                status: 200
            });

        } catch (writeError) {
            console.error(`Error writing file to ${fullPath}:`, writeError);
            return res.status(500).send({
                error: "Failed to write downloaded file to local disk",
                details: writeError instanceof Error ? writeError.message : String(writeError),
                status: 500
            });
        }

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            let errorBody: any = "Unknown error";
            try {
                if (error.response.data instanceof ArrayBuffer) {
                    errorBody = JSON.parse(Buffer.from(error.response.data).toString('utf-8'));
                } else {
                    errorBody = error.response.data;
                }
            } catch (e) {
                errorBody = "Failed to parse error response from peer";
            }
            
            console.error(`Error ${error.response.status} from ${destinationAddress} downloading file ${fileId}:`, errorBody);
            return res.status(error.response.status).send({
                error: `Remote peer failed to provide file`,
                details: errorBody,
                status: error.response.status
            });
        } else {
            console.error(`Network error downloading file ${fileId} from ${destinationAddress}:`, error);
            return res.status(503).send({
                error: "Network error during file download",
                details: error instanceof Error ? error.message : 'Cannot connect to remote peer',
                status: 503
            });
        }
    }
});

export { appLocal };