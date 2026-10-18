/** Shared list policy. Profile access never grants access to a personal list. */
export const LIST_ACCESS_SQL = `(
  l.owner_id = $2::uuid
  OR l.visibility = 'public'
  OR (l.visibility = 'circles' AND $2::uuid IS NOT NULL AND EXISTS (
    SELECT 1 FROM list_circle_access la JOIN circle_members cm ON cm.circle_id = la.circle_id
    WHERE la.list_id = l.id AND cm.user_id = $2::uuid
  ))
  OR (l.visibility <> 'private' AND $3::uuid IS NOT NULL AND EXISTS (
    SELECT 1 FROM profile_share_links share
    JOIN profile_share_link_lists selection ON selection.share_link_id = share.id
    WHERE share.owner_id = l.owner_id AND share.token = $3::uuid
      AND selection.list_id = l.id AND share.revoked_at IS NULL
      AND (share.expires_at IS NULL OR share.expires_at > now())
  ))
)`;
