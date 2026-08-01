-- ╔══════════════════════════════════════════════════════════╗
-- ║   Allow 'rpc' as an offline_sync_queue operation type     ║
-- ╚══════════════════════════════════════════════════════════╝
-- Offline POS checkout queues a call to the process_sale() RPC function
-- (see 016_atomic_process_sale.sql) instead of a plain table insert/update/
-- delete, so the sync queue needs a matching operation type.

ALTER TABLE offline_sync_queue DROP CONSTRAINT IF EXISTS offline_sync_queue_operation_check;
ALTER TABLE offline_sync_queue ADD CONSTRAINT offline_sync_queue_operation_check
  CHECK (operation IN ('insert', 'update', 'delete', 'rpc'));
