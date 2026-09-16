import type { Pool } from "pg";

// Server-side membership resolution — never trust a client-submitted workspace_id alone.
// For this Phase 4 vertical slice, a user's personal workspace (created atomically at
// registration by the 0002 migration's trigger) is the only workspace in play; explicit
// multi-workspace selection is deferred (P1 agency workspaces).
export async function resolvePersonalWorkspaceId(pool: Pool, userId: string): Promise<string> {
  const res = await pool.query<{ workspace_id: string }>(
    `select workspace_id from workspace_members where user_id = $1 order by created_at asc limit 1`,
    [userId],
  );
  if (res.rows.length === 0) throw new Error(`No workspace found for user ${userId}`);
  return res.rows[0].workspace_id;
}

export async function assertWorkspaceMember(pool: Pool, workspaceId: string, userId: string): Promise<void> {
  const res = await pool.query(
    `select 1 from workspace_members where workspace_id = $1 and user_id = $2`,
    [workspaceId, userId],
  );
  if (res.rows.length === 0) throw new Error("not_a_member");
}
