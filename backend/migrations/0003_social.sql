-- Social account links use server-encrypted OAuth tokens. TikTok is read/export only.
CREATE TABLE social_connections (
  platform TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  username TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'connected',
  tokens_enc TEXT NOT NULL,
  tokens_iv TEXT NOT NULL,
  access_expires_at INTEGER NOT NULL,
  refresh_expires_at INTEGER,
  last_sync TEXT,
  updated_at TEXT NOT NULL,
  last_error TEXT
);

CREATE TABLE social_oauth_states (
  state_hash TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX social_oauth_expiry ON social_oauth_states(expires_at);

-- Kontak-owned account posts are stored separately from public market posts,
-- so they never inflate trend counts.
CREATE TABLE social_posts (
  platform TEXT NOT NULL,
  platform_post_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  permalink TEXT,
  caption TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  reach INTEGER,
  saves INTEGER,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (platform, platform_post_id)
);
CREATE INDEX social_posts_published ON social_posts(platform, published_at DESC);

-- One idempotent publish job per idea. The API publishes only Instagram ideas
-- after a signed-in moderator confirms the exact preview fingerprint.
CREATE TABLE social_publish_jobs (
  idea_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  container_id TEXT,
  media_id TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE ideas ADD COLUMN published_at TEXT;
