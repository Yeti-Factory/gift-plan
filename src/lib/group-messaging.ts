export type GroupConversation = {
  id: string;
  title: string;
  updated_at: string;
  unread: number;
  participant_count: number;
};
export type GroupInbox = { groups: GroupConversation[]; hasMore: boolean };
export type GroupMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};
export type GroupThread = {
  conversation: { id: string; title: string };
  participants: {
    id: string;
    display_name: string | null;
    username: string;
    blocked_by_me: boolean;
  }[];
  messages: GroupMessage[];
  hasMore: boolean;
  canSend: boolean;
};
