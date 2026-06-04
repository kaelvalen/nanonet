DROP INDEX IF EXISTS idx_agent_tokens_service_id;

ALTER TABLE agent_tokens
    DROP COLUMN IF EXISTS service_id;
