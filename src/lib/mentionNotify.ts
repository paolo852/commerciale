import { isDemoMode, supabase } from './supabase';
import type { ProjectManager } from '../types';

export async function sendMentionNotifications(
  mentionedPmIds: string[],
  pmById: Map<string, ProjectManager>,
  authorName: string,
  commentBody: string,
  entityUrl: string | null,
) {
  if (isDemoMode || !supabase || mentionedPmIds.length === 0) return;
  const truncated = commentBody.length > 300 ? commentBody.slice(0, 300) + '…' : commentBody;
  await Promise.all(mentionedPmIds.map((pmId) => {
    const pm = pmById.get(pmId);
    if (!pm?.email) return Promise.resolve();
    return supabase!.functions.invoke('send-notification-email', {
      body: {
        to: pm.email,
        subject: `${authorName} ti ha menzionato in un commento`,
        body: `Sei stato menzionato in un commento.`,
        url: entityUrl,
        fields: [
          { label: 'Menzionato da', value: authorName },
          { label: 'Commento', value: truncated },
        ],
      },
    }).catch(() => {});
  }));
}
