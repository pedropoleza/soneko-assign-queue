import { ghlFetch } from "./client";
import type { ConversationItem } from "@/lib/types";

/** Conversations (GHL v2). Normalized for the activity dashboard. */

interface RawConversation {
  id: string;
  contactId?: string;
  fullName?: string;
  contactName?: string;
  lastMessageType?: string;
  type?: string;
  unreadCount?: number;
  lastMessageDate?: number | string;
}

const CHANNEL_LABEL: Record<string, string> = {
  TYPE_SMS: "SMS",
  TYPE_EMAIL: "Email",
  TYPE_WHATSAPP: "WhatsApp",
  TYPE_CALL: "Ligação",
  TYPE_PHONE: "Ligação",
  TYPE_FACEBOOK: "Facebook",
  TYPE_INSTAGRAM: "Instagram",
  TYPE_WEBCHAT: "Webchat",
  TYPE_GMB: "Google",
  TYPE_LIVE_CHAT: "Webchat",
};

export function channelLabel(t?: string): string {
  if (!t) return "Outro";
  return CHANNEL_LABEL[t] ?? t.replace(/^TYPE_/, "").toLowerCase();
}

export async function getConversations(locationId: string, limit = 100): Promise<ConversationItem[]> {
  const data = await ghlFetch<{ conversations?: RawConversation[] }>("/conversations/search", {
    locationId,
    query: { locationId, limit },
  });
  return (data.conversations ?? []).map((c) => ({
    id: c.id,
    contactId: c.contactId,
    name: c.contactName ?? c.fullName ?? "(sem nome)",
    channel: channelLabel(c.lastMessageType ?? c.type),
    unread: c.unreadCount ?? 0,
    lastAt: c.lastMessageDate ? new Date(c.lastMessageDate).toISOString() : undefined,
  }));
}
