CREATE TABLE IF NOT EXISTS direct_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_high uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  initiated_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','accepted','declined')),
  read_low bigint NOT NULL DEFAULT 0,
  read_high bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_low,user_high),
  CHECK (user_low < user_high),
  CHECK (initiated_by IN (user_low,user_high))
);
CREATE INDEX IF NOT EXISTS direct_conversations_high ON direct_conversations(user_high,updated_at DESC);
CREATE INDEX IF NOT EXISTS direct_conversations_low ON direct_conversations(user_low,updated_at DESC);
CREATE TABLE IF NOT EXISTS direct_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_nonce uuid NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sender_id,client_nonce)
);
CREATE INDEX IF NOT EXISTS direct_messages_conversation ON direct_messages(conversation_id,id DESC);
CREATE INDEX IF NOT EXISTS direct_messages_sender ON direct_messages(sender_id,created_at DESC);
CREATE TABLE IF NOT EXISTS direct_message_blocks (
  blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(blocker_id,blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE TABLE IF NOT EXISTS direct_message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id bigint NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE(reporter_id,message_id)
);
