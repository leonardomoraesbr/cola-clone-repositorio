
-- Table to track broadcast sent messages (for deletion feature)
CREATE TABLE public.broadcast_sent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id text NOT NULL,
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  chat_id bigint NOT NULL,
  message_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_sent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage broadcast_sent_messages"
  ON public.broadcast_sent_messages FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_broadcast_sent_broadcast_id ON public.broadcast_sent_messages(broadcast_id);

-- Add last_sent_at and revenue tracking to mailing_messages
ALTER TABLE public.mailing_messages ADD COLUMN IF NOT EXISTS revenue_generated numeric DEFAULT 0;
