CREATE TABLE IF NOT EXISTS group_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  client_nonce uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (created_by,client_nonce),
  UNIQUE (id,circle_id)
);
CREATE TABLE IF NOT EXISTS group_participants (
  conversation_id uuid NOT NULL,
  circle_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_through bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id,user_id),
  FOREIGN KEY (conversation_id,circle_id) REFERENCES group_conversations(id,circle_id) ON DELETE CASCADE,
  FOREIGN KEY (circle_id,user_id) REFERENCES circle_members(circle_id,user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS group_participants_user ON group_participants(user_id,conversation_id);
CREATE TABLE IF NOT EXISTS group_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES group_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_nonce uuid NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_id,client_nonce)
);
CREATE INDEX IF NOT EXISTS group_messages_thread ON group_messages(conversation_id,id DESC);
CREATE INDEX IF NOT EXISTS group_messages_sender ON group_messages(sender_id,created_at DESC);
CREATE TABLE IF NOT EXISTS group_message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id bigint NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (reporter_id,message_id)
);
