-- migrate:up
-- The editor's decision is 'approved' or 'rejected' (Guide §8 Slice 2.12); the baseline allows no
-- 'approved'.
ALTER TABLE conflation_review_queue DROP CONSTRAINT conflation_review_queue_status_check;
ALTER TABLE conflation_review_queue ADD CONSTRAINT conflation_review_queue_status_check
  CHECK (status IN ('pending', 'approved', 'merged', 'rejected'));

-- migrate:down
-- The old constraint cannot hold an approval, so approvals go back into the queue.
UPDATE conflation_review_queue SET status = 'pending' WHERE status = 'approved';
ALTER TABLE conflation_review_queue DROP CONSTRAINT conflation_review_queue_status_check;
ALTER TABLE conflation_review_queue ADD CONSTRAINT conflation_review_queue_status_check
  CHECK (status IN ('pending', 'merged', 'rejected'));
