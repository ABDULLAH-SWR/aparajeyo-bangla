-- migrate:up
-- The importer once wrote 'ok'. The API counts only 'succeeded' runs.
UPDATE sync_runs SET status = 'succeeded' WHERE status = 'ok';

-- migrate:down
-- Irreversible data fix: rows that were 'ok' can no longer be told apart.
