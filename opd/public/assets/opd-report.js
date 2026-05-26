/**
 * Report prompt — POST /v1/prompts/:id/report (minimal infra; full UX later).
 */
import { OPD_SITE_ORIGIN } from './opd-common.js';

let modalEl = null;

function ensureReportModal() {
  if (modalEl) return modalEl;

  modalEl = document.createElement('div');
  modalEl.id = 'opd-report-modal';
  modalEl.className = 'opd-report-modal';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-label', 'Report prompt');
  modalEl.hidden = true;
  modalEl.innerHTML = `
    <div class="opd-report-backdrop" data-opd-report-close></div>
    <div class="opd-report-dialog">
      <h2 class="opd-report-title">Report this prompt</h2>
      <p class="pm-subtitle opd-report-body" id="opd-report-status">
        Choose a reason and submit. Reports are reviewed manually.
      </p>
      <label class="settings-field-label" for="opd-report-reason">Reason</label>
      <select id="opd-report-reason" class="opm-input-field">
        <option value="spam">Spam</option>
        <option value="malware">Malware / unsafe</option>
        <option value="illegal">Illegal content</option>
        <option value="harassment">Harassment</option>
        <option value="other">Other</option>
      </select>
      <label class="settings-field-label" for="opd-report-detail">Details (optional)</label>
      <textarea id="opd-report-detail" class="opm-input-field" rows="3" maxlength="500"></textarea>
      <div class="opd-report-actions">
        <button type="button" class="main" id="opd-report-submit">Submit report</button>
        <button type="button" class="main opd-btn-secondary" data-opd-report-close>Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  modalEl.querySelectorAll('[data-opd-report-close]').forEach((el) => {
    el.addEventListener('click', closeReportModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalEl && !modalEl.hidden) closeReportModal();
  });

  return modalEl;
}

export function openReportModal() {
  ensureReportModal();
  modalEl.hidden = false;
  document.body.classList.add('opd-report-open');
}

export function closeReportModal() {
  if (!modalEl) return;
  modalEl.hidden = true;
  document.body.classList.remove('opd-report-open');
}

/**
 * @param {object} prompt
 */
export async function reportPrompt(prompt) {
  const modal = ensureReportModal();
  const status = modal.querySelector('#opd-report-status');
  const submitBtn = modal.querySelector('#opd-report-submit');
  if (status) status.textContent = 'Choose a reason and submit. Reports are reviewed manually.';
  openReportModal();

  if (!submitBtn || submitBtn.dataset.opdWired === '1') return;
  submitBtn.dataset.opdWired = '1';

  submitBtn.addEventListener('click', async () => {
    const reason = modal.querySelector('#opd-report-reason')?.value || 'other';
    const detail = modal.querySelector('#opd-report-detail')?.value || '';
    submitBtn.disabled = true;
    try {
      const res = await fetch(
        `${OPD_SITE_ORIGIN}/v1/prompts/${encodeURIComponent(prompt.id)}/report`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, detail }),
        }
      );
      if (res.ok || res.status === 202) {
        if (status) status.textContent = 'Thank you — your report was received.';
      } else if (status) {
        status.textContent = 'Could not submit report. Try again later.';
      }
    } catch {
      if (status) status.textContent = 'Could not submit report. Try again later.';
    } finally {
      submitBtn.disabled = false;
    }
  });
}
