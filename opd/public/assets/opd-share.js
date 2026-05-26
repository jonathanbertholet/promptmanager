/**
 * Share prompt detail — native share on mobile; clipboard copy on desktop.
 */
import { promptShareMessage } from './opd-seo.js';

/**
 * @param {object} prompt
 */
export function promptPageUrl(prompt) {
  return `${window.location.origin}/p/${encodeURIComponent(prompt.id)}`;
}

/**
 * Use the OS share sheet only on phones/tablets — desktop copies to clipboard instead.
 */
function shouldUseNativeShare() {
  if (!navigator.share) return false;
  if (window.matchMedia('(max-width: 768px)').matches) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

/**
 * @param {object} prompt
 * @returns {Promise<'shared'|'copied'|'cancelled'|'unsupported'>}
 */
export async function sharePrompt(prompt) {
  const url = promptPageUrl(prompt);
  const text = promptShareMessage(prompt);
  const clipboardPayload = `${text}\n${url}`;

  if (shouldUseNativeShare()) {
    try {
      await navigator.share({
        title: 'Open Prompt Database',
        text,
        url,
      });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      /* fall through to clipboard if share fails */
    }
  }

  try {
    await navigator.clipboard.writeText(clipboardPayload);
    return 'copied';
  } catch {
    return 'unsupported';
  }
}
