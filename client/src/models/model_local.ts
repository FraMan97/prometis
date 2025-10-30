import z from "zod";

export const StartSessionTestSchema = z.object({
  senderAddress: z.string(),
  destinationAddress: z.string(),
  senderNickname: z.string(),
  destinationNickname: z.string(),
  senderPublicKey: z.string(),
  destinationPublicKey: z.string()
});

export const CloseSessionTestSchema = z.object({
  senderAddress: z.string(),
  destinationAddress: z.string()
});

export const SendMessageTestSchema = z.object({
  destinationAddress: z.string(),
  message: z.string(),
  senderAddress: z.string()
});

export const UploadFileTestSchema = z.object({
  ttl: z.number().positive().max(86400)
});

export const DownloadFileTestSchema = z.object({
  fileId: z.string(),
  downloadPath: z.string(),
  destinationAddress: z.string()
});

export interface GetMessagesQueryTestSchema {
  destinationAddress: string
}

export const ActiveNodesQueryParamTestSchema = z.object({
  address: z.string().optional()
})


export const SubscriptionTestSchema = z.object({
  address: z.string(),
  nickname: z.string(),
  publicKey: z.string()
});

export const UnSubscriptionTestSchema = z.object({
  address: z.string(),
});

export type ActiveNodesQueryTestParam = z.infer<typeof ActiveNodesQueryParamTestSchema>;
export type StartSessionTestBody = z.infer<typeof StartSessionTestSchema>;
export type CloseSessionTestBody = z.infer<typeof CloseSessionTestSchema>;
export type SendMessageTestBody = z.infer<typeof SendMessageTestSchema>;
export type UploadFileTestBody = z.infer<typeof UploadFileTestSchema>;
export type DownloadFileTestBody = z.infer<typeof DownloadFileTestSchema>;
export type SubscriptionTestBody = z.infer<typeof SubscriptionTestSchema>;
export type UnSubscriptionTestBody = z.infer<typeof UnSubscriptionTestSchema>;

