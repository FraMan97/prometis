import z from "zod";

export const StartSessionSchema = z.object({
  senderAddress: z.string(),
  senderNickname: z.string(),
  senderPublicKey: z.string(),
  encryptedSessionKey: z.string(),
  signature: z.string(),
});

export const CloseSessionSchema = z.object({
  senderAddress: z.string(),
  signature: z.string()
});

export const SendMessageSchema = z.object({
  senderAddress: z.string(),
  encryptedMessage: z.string(),
  iv: z.string(),
  signature: z.string()
});

export const DownloadFileSchema = z.object({
  fileId: z.string(),
});


export type StartSessionBody = z.infer<typeof StartSessionSchema>;
export type CloseSessionBody = z.infer<typeof CloseSessionSchema>;
export type SendMessageBody = z.infer<typeof SendMessageSchema>;
export type DownloadFileBody = z.infer<typeof DownloadFileSchema>;
