import { isDemoMode, supabase } from './supabase';
import { notificationPrefsService } from './dataService';
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
  await Promise.all(mentionedPmIds.map(async (pmId) => {
    const pm = pmById.get(pmId);
    if (!pm?.email) return;

    // Controlla le prefs email del destinatario (user_id del PM sull'account auth).
    // Se il PM non ha un account auth (user_id null) o ha email_comment_mention=false,
    // non inviare l'email.
    if (pm.user_id) {
      const prefs = await notificationPrefsService.getForUser(pm.user_id).catch(() => null);
      // Se prefs esiste ma email_comment_mention è false → skip
      if (prefs && !prefs.email_comment_mention) return;
    } else {
      // PM senza account auth → nessuna preferenza registrata → non inviare
      return;
    }

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
