/**
 * Generate ~250 demo prompts for OPD local seed (written to data/demo-prompts.json).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../data');
const outPath = path.join(outDir, 'demo-prompts.json');

/** Target catalog size for preload. */
const TARGET_COUNT = 250;

const AUTHORS = [
  'opm-demo',
  'jordan-writes',
  'devtools-lab',
  'marketing-team',
  'support-hub',
  'research-desk',
  'creative-studio',
  'product-notes',
  'data-vault',
  'sales-playbook',
];

const TAG_POOL = [
  'work',
  'email',
  'writing',
  'code',
  'research',
  'marketing',
  'personal',
  'support',
  'creative',
  'education',
  'product',
  'design',
  'data',
  'sales',
  'hr',
  'legal',
  'finance',
  'health',
  'devops',
  'ai',
];

/** Base templates — expanded with variants to reach TARGET_COUNT. */
const TEMPLATES = [
  {
    title: 'Follow-up email',
    content:
      'Write a short follow-up email to #recipient# about #topic#. Tone: #tone#. Max 120 words.',
    tags: ['work', 'email', 'writing'],
  },
  {
    title: 'Meeting summary',
    content: 'Summarize decisions, action items, and owners from:\n\n#notes#',
    tags: ['work', 'writing'],
  },
  {
    title: 'Bug report',
    content:
      'Turn this into a bug report with steps, expected vs actual, and environment:\n\n#description#',
    tags: ['work', 'code', 'support'],
  },
  {
    title: 'Code review',
    content:
      'Review this #language# code for readability, edge cases, and security. Prioritize findings:\n\n#code#',
    tags: ['code', 'work'],
  },
  {
    title: 'Refactor plan',
    content:
      'Propose a minimal refactor for #module# that reduces complexity. Include risks and tests.',
    tags: ['code', 'research'],
  },
  {
    title: 'SQL explainer',
    content: 'Explain this SQL query table-by-table and suggest one index if needed:\n\n#query#',
    tags: ['code', 'data'],
  },
  {
    title: 'Blog outline',
    content:
      'Outline a blog post titled "#title#" for #audience#. Hook, 4–6 sections, CTA.',
    tags: ['writing', 'marketing'],
  },
  {
    title: 'Social caption',
    content:
      'Write 3 captions for #platform# promoting #product#. Tone: #tone#. Include hashtags.',
    tags: ['writing', 'marketing'],
  },
  {
    title: 'Landing headline',
    content: 'Generate 5 headline/subheadline pairs for #offer#. Lead with a clear benefit.',
    tags: ['marketing', 'writing'],
  },
  {
    title: 'Support reply',
    content:
      'Draft a support reply. Acknowledge, explain next steps, stay empathetic:\n\n#message#',
    tags: ['support', 'email', 'work'],
  },
  {
    title: 'FAQ answer',
    content: 'Write a concise FAQ answer for: "#question#". Plain language, one example.',
    tags: ['support', 'writing'],
  },
  {
    title: 'Research brief',
    content:
      'One-page research brief on #topic#: context, key questions, sources, success criteria.',
    tags: ['research', 'work'],
  },
  {
    title: 'Pros and cons',
    content: 'Balanced pros/cons for #decision#. Recommend based on #priority#.',
    tags: ['research', 'personal'],
  },
  {
    title: 'Weekly plan',
    content:
      'Plan my week. Goals: #goals#. Constraints: #constraints#. Day-by-day with top 3 priorities.',
    tags: ['personal', 'work'],
  },
  {
    title: 'Journal reflection',
    content: 'Ask 5 reflection questions about #theme# and one small action for tomorrow.',
    tags: ['personal', 'writing'],
  },
  {
    title: 'Translate text',
    content: 'Translate to #language#. Natural phrasing:\n\n#text#',
    tags: ['writing', 'research'],
  },
  {
    title: 'Simplify wording',
    content:
      'Rewrite for #audience# at 8th-grade level without losing facts:\n\n#passage#',
    tags: ['writing', 'education'],
  },
  {
    title: 'Regex helper',
    content:
      'Write a regex for #pattern_description# in #language#. Explain parts + 2 test cases.',
    tags: ['code'],
  },
  {
    title: 'API endpoint docs',
    content:
      'Document endpoint: method, path, auth, body, response schema, curl example.\n\n#endpoint_spec#',
    tags: ['code', 'work', 'writing'],
  },
  {
    title: 'Brainstorm ideas',
    content: 'Brainstorm 12 ideas for #challenge#. Group by theme; mark top 3.',
    tags: ['research', 'marketing', 'personal'],
  },
  {
    title: 'PR description',
    content:
      'Write a PR description for these changes. Summary, motivation, test plan:\n\n#diff_summary#',
    tags: ['code', 'work'],
  },
  {
    title: 'Release notes',
    content: 'Draft user-facing release notes from #changelog#. Group by feature/fix.',
    tags: ['product', 'writing'],
  },
  {
    title: 'User story',
    content:
      'Write a user story for #feature# using "As a… I want… so that…" plus acceptance criteria.',
    tags: ['product', 'work'],
  },
  {
    title: 'Interview questions',
    content: 'Generate 8 interview questions for a #role# focusing on #skill_area#.',
    tags: ['hr', 'work'],
  },
  {
    title: 'Job description',
    content: 'Draft a job description for #role# at #company_type#. Responsibilities and requirements.',
    tags: ['hr', 'writing'],
  },
  {
    title: 'Cold outreach',
    content: 'Write a cold email to #prospect# about #value_prop#. Under 150 words, one CTA.',
    tags: ['sales', 'email'],
  },
  {
    title: 'Pitch deck bullets',
    content: 'Turn #idea# into 8 slide bullets: problem, solution, market, traction, ask.',
    tags: ['sales', 'marketing'],
  },
  {
    title: 'Contract summary',
    content:
      'Summarize key terms, obligations, and risks in plain language (not legal advice):\n\n#clause_text#',
    tags: ['legal', 'work'],
  },
  {
    title: 'Budget breakdown',
    content: 'Explain this budget line by line and flag unusual items:\n\n#budget_table#',
    tags: ['finance', 'work'],
  },
  {
    title: 'Lesson plan',
    content: 'Create a 45-minute lesson on #topic# for #grade_level#. Objectives, activities, assessment.',
    tags: ['education', 'writing'],
  },
  {
    title: 'Quiz questions',
    content: 'Write 10 quiz questions (mix MCQ and short answer) on #topic# with answer key.',
    tags: ['education', 'research'],
  },
  {
    title: 'Workout plan',
    content: 'Design a #duration# workout for #goal# with #equipment# available. Include warm-up.',
    tags: ['health', 'personal'],
  },
  {
    title: 'Meal prep ideas',
    content: 'Suggest 5 meals for #dietary_goals# under #time_budget# prep time per week.',
    tags: ['health', 'personal'],
  },
  {
    title: 'Poetry prompt',
    content: 'Write a #form# poem about #subject# using imagery from #setting#.',
    tags: ['creative', 'writing'],
  },
  {
    title: 'Character backstory',
    content: 'Create a backstory for #character_name# in a #genre# story. Motivation and flaw.',
    tags: ['creative', 'writing'],
  },
  {
    title: 'UI microcopy',
    content: 'Improve button labels, empty states, and error messages for #screen#:\n\n#current_copy#',
    tags: ['design', 'product'],
  },
  {
    title: 'Design critique',
    content: 'Critique this UI for hierarchy, accessibility, and consistency:\n\n#description#',
    tags: ['design', 'product'],
  },
  {
    title: 'Data analysis plan',
    content: 'Outline an analysis for #question# using #dataset#. Metrics, charts, caveats.',
    tags: ['data', 'research'],
  },
  {
    title: 'Chart caption',
    content: 'Write a chart title and 2-sentence caption explaining #trend# for executives.',
    tags: ['data', 'writing'],
  },
  {
    title: 'Incident postmortem',
    content:
      'Draft a blameless postmortem: timeline, root cause, impact, action items:\n\n#incident_notes#',
    tags: ['devops', 'work'],
  },
  {
    title: 'Runbook draft',
    content: 'Write a runbook for #alert_name# including diagnosis steps and rollback.',
    tags: ['devops', 'support'],
  },
  {
    title: 'Prompt chain',
    content: 'Break #task# into 4 chained prompts for a multi-step AI workflow with handoff notes.',
    tags: ['ai', 'research'],
  },
  {
    title: 'System prompt',
    content:
      'Write a system prompt for an assistant that helps with #domain#. Rules, tone, refusals.',
    tags: ['ai', 'work'],
  },
  {
    title: 'Tone shift',
    content: 'Rewrite in a #tone# tone without changing facts:\n\n#text#',
    tags: ['writing', 'marketing'],
  },
  {
    title: 'Executive summary',
    content: 'One-page executive summary of #report# for #stakeholder#.',
    tags: ['work', 'writing'],
  },
  {
    title: 'Competitive analysis',
    content: 'Compare #product# vs #competitors# on features, pricing, positioning.',
    tags: ['marketing', 'research'],
  },
  {
    title: 'Onboarding checklist',
    content: 'Checklist for new #role# hires at #company_type# covering week 1 and month 1.',
    tags: ['hr', 'product'],
  },
  {
    title: 'NPS response',
    content: 'Reply to this NPS feedback. Thank them and address the theme:\n\n#feedback#',
    tags: ['support', 'product'],
  },
  {
    title: 'Policy explainer',
    content: 'Explain #policy_name# to employees in FAQ format (5 Q&As).',
    tags: ['hr', 'writing'],
  },
  {
    title: 'Grant abstract',
    content: '200-word grant abstract for research on #topic#. Problem, method, impact.',
    tags: ['research', 'education'],
  },
];

const VARIANTS = [
  '',
  ' (quick)',
  ' (detailed)',
  ' — v2',
  ' for startups',
  ' for enterprise',
  ' — template',
  ' — checklist',
];

/**
 * Pick n random unique tags from pool (including template defaults).
 * @param {string[]} base
 */
function pickTags(base) {
  const set = new Set(base);
  while (set.size < 2 + Math.floor(Math.random() * 2)) {
    set.add(TAG_POOL[Math.floor(Math.random() * TAG_POOL.length)]);
  }
  return [...set].slice(0, 4);
}

/**
 * Pseudo-random import count — modest totals for demo authors (sort-by-imports still has spread).
 * @param {number} i
 */
function importCount(i) {
  const r = (i * 7919 + 104729) % 1000;
  if (r < 25) return 18 + (r % 32);
  if (r < 120) return 3 + (r % 9);
  return r % 3;
}

/**
 * ISO date spread over ~14 months ending May 2025.
 * @param {number} i
 */
function publishedAt(i) {
  const end = new Date('2025-05-20T12:00:00.000Z').getTime();
  const span = 420 * 24 * 60 * 60 * 1000;
  const t = end - (i / TARGET_COUNT) * span - (i % 17) * 3600000;
  return new Date(t).toISOString();
}

const prompts = [];
let n = 0;

for (let t = 0; t < TEMPLATES.length && n < TARGET_COUNT; t++) {
  for (let v = 0; v < VARIANTS.length && n < TARGET_COUNT; v++) {
    const tpl = TEMPLATES[t];
    const variant = VARIANTS[v];
    const idx = n + 1;
    prompts.push({
      uuid: `demo-${String(idx).padStart(4, '0')}`,
      title: `${tpl.title}${variant}`,
      content: tpl.content,
      tags: pickTags(tpl.tags),
      author: AUTHORS[n % AUTHORS.length],
      createdAt: publishedAt(n),
      importCount: importCount(n),
    });
    n++;
  }
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, `${JSON.stringify(prompts, null, 2)}\n`, 'utf8');
console.log(`Wrote ${prompts.length} demo prompts to ${outPath}`);
