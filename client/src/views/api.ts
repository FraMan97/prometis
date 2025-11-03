import express, { Application, Request, Response } from 'express';
import { SessionChannel } from '../services/session_channel';
import { CloseSessionBody, CloseSessionSchema, DownloadFileBody, DownloadFileSchema, SendMessageBody, SendMessageSchema, StartSessionBody, StartSessionSchema } from '../models/model';
import { validateCloseSession, validateDownloadFile, validateSendMessage, validateStartSession } from '../services/validation'; // Renamed imports
import { downloadFileLimiter, fileCache, messagesQueue, openedSessions, sendMessageLimiter } from '../models/global';
import { Message } from '../services/message';
import { verifySignature } from '../services/common';
import { sessionLimiter } from '../models/global';

export const app: Application = express();

app.use(express.json());

app.post("/api/start-session", validateStartSession(StartSessionSchema), sessionLimiter, (req: Request<{}, {}, StartSessionBody, {}>, res: Response) => {
    try {
        const { senderAddress: senderAddress, senderNickname: senderNickname, senderPublicKey: senderPublicKey, encryptedSessionKey: encryptedSessionKey, signature, ...rest } = req.body;
        const dataToVerify = { senderAddress: senderAddress, senderPublicKey: senderPublicKey, senderNickname: senderNickname, encryptedSessionKey: encryptedSessionKey};

        if (!verifySignature(JSON.stringify(dataToVerify), signature, senderPublicKey)) {
            console.log("Sender not verified");
            return res.status(403).send({ "error": `Sender not verified`, "status": 403 });
        }

        if (openedSessions.has(senderAddress)) {
            console.log(`Session already exists with: ${senderAddress}`);
            return res.status(409).send({ "error": `Session already exists with ${senderAddress}`, "status": 409 });
        }


        console.log("Sender verified", senderAddress);
        console.log("Starting session with ", senderAddress);
        let sessionChannel = new SessionChannel(senderPublicKey, senderNickname);
        sessionChannel.setEncryptedSessionKey(Buffer.from(encryptedSessionKey, 'base64'));
        sessionChannel.setSessionKey(sessionChannel.decryptEncryptedSessionKey());
        openedSessions.set(senderAddress, sessionChannel);

        if (!messagesQueue.has(senderAddress)) {
           messagesQueue.set(senderAddress, []);
        }


        console.log(`Session established with: `, senderAddress);
        res.status(200).send({ "message": `Session started with ${senderAddress}:${senderNickname}`, "status": 200 });

    } catch (error) {
        console.error("start-session internal server error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        res.status(500).send({ "error": "start-session internal server error", "details": errorMessage, "status": 500 });
    }
});


app.post("/api/close-session", validateCloseSession(CloseSessionSchema), sessionLimiter, (req: Request<{}, {}, CloseSessionBody, {}>, res: Response) => {
    try {
        const { senderAddress: senderAddress, signature } = req.body;
        const sessionChannel = openedSessions.get(senderAddress);

        if (!sessionChannel) {
            console.log("Session doesn't exist with ", senderAddress);
            return res.status(200).send({ "message": `Session already closed or never existed with ${senderAddress}`, "status": 200 });
        }

        if (!verifySignature(senderAddress, signature, sessionChannel.getPublicKeyDest())) {
            console.log("Sender not verified for close-session");
            return res.status(403).send({ "error": `Sender not verified`, "status": 403 });
        }

        openedSessions.delete(senderAddress);
        messagesQueue.delete(senderAddress);
        console.log(`Closed session with: `, senderAddress);
        res.status(200).send({ "message": `Session closed with ${senderAddress}`, "status": 200 });

    } catch (error) {
        console.error("close-session internal server error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        res.status(500).send({ "error": "close-session internal server error", "details": errorMessage, "status": 500 });
    }
});


app.post("/api/send-message", validateSendMessage(SendMessageSchema), sendMessageLimiter, (req: Request<{}, {}, SendMessageBody, {}>, res: Response) => {
    try {
        const { senderAddress: senderAddress, encryptedMessage: encryptedMessage, iv, signature, ...rest } = req.body;
        const dataToVerify = { encryptedMessage: encryptedMessage, iv: iv, senderAddress: senderAddress };

        const sessionChannel = openedSessions.get(senderAddress);

        if (!sessionChannel) {
            console.log("Session doesn't exist with ", senderAddress);
            return res.status(400).send({ "error": `Session doesn't exist with ${senderAddress}. Cannot receive message.`, "status": 400 });
        }

        if (!verifySignature(JSON.stringify(dataToVerify), signature, sessionChannel.getPublicKeyDest())) {
            console.log("Sender not verified for send-message");
            return res.status(403).send({ "error": `Sender not verified`, "status": 403 });
        }

        const message = sessionChannel.decryptMessage(encryptedMessage, iv);

        if (message !== null && message !== undefined) { 
            console.log(`Received message "${message.substring(0, 30)}..." from ${senderAddress}`);
            let messages = messagesQueue.get(senderAddress);
            if (!messages) {
                messages = [];
                messagesQueue.set(senderAddress, messages);
            }
             messages.push(new Message(senderAddress, message));

            res.status(200).send({ "message": `Message received from ${senderAddress}`, "status": 200 });
        } else {
             console.error(`Error while decrypting message from ${senderAddress}`);
             res.status(400).send({ "error": `Error while decrypting message from ${senderAddress}`, "status": 400 });
        }
    } catch (error) {
        console.error("send-message internal server error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred during message processing";
        if (errorMessage.includes('decipher')) {
           res.status(400).send({ "error": "Decryption failed", "details": errorMessage, "status": 400 });
        } else {
           res.status(500).send({ "error": "send-message internal server error", "details": errorMessage, "status": 500 });
        }
    }
});


app.post("/api/download-file", validateDownloadFile(DownloadFileSchema), downloadFileLimiter, async (req: Request<{}, {}, DownloadFileBody, {}>, res: Response) => {
    const fileId = req.body.fileId;
    if (!fileId) {
        return res.status(400).send({ "error": "Missing fileId in request body", "status": 400 });
    }

    try {
        const fileData = fileCache.get<any>(fileId);

        if (!fileData || !fileData.buffer) { 
            console.log(`File not found or expired in cache: ${fileId}`);
            return res.status(404).send({ "error": "File not found or expired", "status": 404 });
        }

        const filename = (typeof fileData.originalName === 'string' ? fileData.originalName : `file_${fileId}`).replace(/[^a-z0-9._-]/gi, '_');


        res.setHeader('Content-Type', fileData.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(fileData.buffer);
        console.log(`Sent file ${fileId} (${filename})`);

    } catch (error) {
         console.error(`Error serving file ${fileId}:`, error);
         const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
         res.status(500).send({ "error": "Internal server error serving file", "details": errorMessage, "status": 500 });
    }
});