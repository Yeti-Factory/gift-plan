export type Conversation = {
  id: string;
  other_id: string;
  username: string;
  display_name: string | null;
  initiated_by: string;
  status: "pending" | "accepted" | "declined";
  blocked: boolean;
  blocked_by_me: boolean;
  unread: number;
  updated_at: string;
};
export type DirectMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
export type MessageInbox = {
  conversations: Conversation[];
  unread: number;
  userId: string;
  hasMore: boolean;
};
export type MessageThread = {
  conversation: Conversation;
  messages: DirectMessage[];
  hasMore: boolean;
};
export function messageError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "RATE_LIMITED") return "Trop de messages. Patientez un peu avant de réessayer.";
  if (code === "FORBIDDEN") return "Cet échange est bloqué, refusé ou en attente d’acceptation.";
  if (code === "NOT_FOUND") return "Cette conversation ou ce compte n’est pas disponible.";
  if (code === "INVALID_REQUEST") return "Vérifiez votre message (1 à 2 000 caractères).";
  return "Impossible de charger ou d’envoyer les messages. Réessayez.";
}
