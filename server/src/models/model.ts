import z from "zod";

export const SubscriptionSchema = z.object({
  address: z.string(),
  nickname: z.string(),
  publicKey: z.string()
});

export const UnSubscriptionSchema = z.object({
  address: z.string(),
  signature: z.string(),
});

export const ActiveNodesQueryParamSchema = z.object({
  address: z.string().optional()
})

export interface PeerNode {
    address: string,
    nickname: string,
    publicKey: string
};


export type SubscriptionBody = z.infer<typeof SubscriptionSchema>;
export type UnSubscriptionBody = z.infer<typeof UnSubscriptionSchema>;
export type ActiveNodesQueryParam = z.infer<typeof ActiveNodesQueryParamSchema>;
