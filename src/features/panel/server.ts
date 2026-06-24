import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { isIP } from "node:net";

import { buildWorkspaceStatus } from "../status/index.js";
import { listMemoryCatalog, showMemoryAtom } from "../memory/index.js";
import { listHandoffs } from "../handoff/index.js";
import { VERSION } from "../../core/version.js";
import { runWorkspaceDoctor } from "../doctor/workspaceDoctor.js";
import { readReservedTaskWriteSet } from "../hooks/taskWriteSet.js";
import { listReleaseCandidates } from "../workflows/releaseCandidate.js";
import { workflowGovernanceStatus } from "../workflows/governance.js";
import { inspectReleaseCandidate } from "../workflows/releaseCandidate.js";
import { workflowReadiness } from "../workflows/readiness.js";
import { listWorkflowDefinitions } from "../workflows/catalog.js";

export interface PanelOptions {
  readonly host?: string;
  readonly port?: number;
  readonly open?: boolean;
}

export interface RunningPanel {
  readonly server: Server;
  readonly url: string;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4999;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = `${JSON.stringify(body, null, 2)}\n`;
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function html(res: ServerResponse, body: string): void {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  });
  res.end(body);
}

function text(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
  });
  res.end(body);
}

function isAllowedHost(header: string | undefined, bind: string): boolean {
  if (!header) return true;
  const host = header.replace(/^\[/, "").split("]")[0]?.split(":")[0] ?? "";
  return host === bind || LOOPBACK_HOSTS.has(host) || isIP(host) === 4 && host.startsWith("127.");
}

function slugifyHeading(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-") || "section";
}

function renderInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function parseFrontmatter(content: string): { attrs: Record<string, string>; body: string } {
  if (!content.startsWith("---\n")) return { attrs: {}, body: content };
  const end = content.indexOf("\n---", 4);
  if (end < 0) return { attrs: {}, body: content };
  const raw = content.slice(4, end).trim();
  const attrs: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (match) attrs[match[1] ?? ""] = (match[2] ?? "").replace(/^['"]|['"]$/g, "");
  }
  return { attrs, body: content.slice(end + 5).trimStart() };
}

function renderMarkdown(content: string): { attrs: Record<string, string>; html: string; toc: Array<{ level: number; id: string; text: string }> } {
  const parsed = parseFrontmatter(content);
  const lines = parsed.body.split(/\r?\n/);
  const htmlParts: string[] = [];
  const toc: Array<{ level: number; id: string; text: string }> = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];

  const flushParagraph = (): void => {
    if (!paragraph.length) return;
    htmlParts.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = (): void => {
    if (!list.length) return;
    htmlParts.push(`<ul>${list.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  };
  const flushCode = (): void => {
    const code = escapeHtml(codeLines.join("\n"));
    if (codeLang === "mermaid") htmlParts.push(`<figure class="diagram"><figcaption>Mermaid diagram</figcaption><div class="mermaid">${code}</div></figure>`);
    else htmlParts.push(`<pre><code>${code}</code></pre>`);
    codeLines = [];
    codeLang = "";
  };

  for (const line of lines) {
    const fence = /^```\s*([A-Za-z0-9_-]+)?\s*$/.exec(line);
    if (fence) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
        codeLang = (fence[1] ?? "").toLowerCase();
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = (heading[1] ?? "").length;
      const text = (heading[2] ?? "").trim();
      const id = slugifyHeading(text);
      toc.push({ level, id, text });
      htmlParts.push(`<h${level} id="${id}">${renderInlineMarkdown(text)}</h${level}>`);
      continue;
    }
    const item = /^\s*[-*]\s+(.+)$/.exec(line);
    if (item) {
      flushParagraph();
      list.push(item[1] ?? "");
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  if (inCode) flushCode();
  return { attrs: parsed.attrs, html: htmlParts.join("\n"), toc };
}

function documentHtml(title: string, subtitle: string, content: string): string {
  const rendered = renderMarkdown(content);
  const meta = Object.entries(rendered.attrs).map(([key, value]) => `<div class="meta-row"><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  const toc = rendered.toc.map((item) => `<a class="toc-level-${item.level}" href="#${item.id}">${escapeHtml(item.text)}</a>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>:root{color-scheme:dark;--bg:#0d1512;--panel:#14211c;--card:#192822;--text:#f2fbf6;--muted:#9fb3aa;--line:#315045;--accent:#87d6ad;--accent2:#6ab7ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#1b3028,#0d1512 34rem);color:var(--text);font:16px/1.65 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}.shell{max-width:1280px;margin:0 auto;padding:28px}.top{display:flex;justify-content:space-between;gap:16px;align-items:start;margin-bottom:24px}.back{color:var(--accent)}h1{font-size:34px;margin:18px 0 4px;letter-spacing:-.03em}.subtitle{color:var(--muted)}.layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:22px}.side{position:sticky;top:18px;align-self:start;display:grid;gap:14px}.box,.article{background:#14211ce6;border:1px solid var(--line);border-radius:18px;box-shadow:0 14px 40px #0005}.box{padding:16px}.box h2{font-size:13px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin:0 0 12px}.meta-row{display:grid;gap:2px;padding:8px 0;border-bottom:1px solid #ffffff12}.meta-row span{color:var(--muted);font-size:12px}.meta-row strong{font-size:13px;overflow-wrap:anywhere}.toc{display:grid;gap:6px}.toc a{color:var(--text);text-decoration:none;border-left:2px solid transparent;padding:4px 0 4px 10px}.toc a:hover{color:var(--accent);border-left-color:var(--accent)}.toc-level-3{margin-left:12px;font-size:14px}.toc-level-4{margin-left:24px;font-size:13px}.article{padding:34px 44px}.article h1,.article h2,.article h3,.article h4{line-height:1.2;letter-spacing:-.02em}.article h1{font-size:32px}.article h2{font-size:26px;margin-top:34px;padding-top:18px;border-top:1px solid #ffffff12}.article h3{font-size:20px;margin-top:26px;color:#c9ffe0}.article p{max-width:82ch}.article a{color:var(--accent);text-decoration-thickness:1px;text-underline-offset:3px}.article code{background:#0b100e;border:1px solid #2b4038;border-radius:6px;padding:1px 5px;color:#d7f8e6}.article pre{white-space:pre-wrap;overflow:auto;background:#08100d;border:1px solid var(--line);border-radius:14px;padding:16px}.article li{margin:7px 0}.diagram{background:#0b100e;border:1px solid var(--line);border-radius:16px;padding:16px;margin:24px 0}.diagram figcaption{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}.mermaid{background:#f7fff9;color:#102018;border-radius:12px;padding:18px;overflow:auto}.empty{color:var(--muted)}@media(max-width:900px){.layout{grid-template-columns:1fr}.side{position:static}.article{padding:24px}}</style><script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script></head><body><div class="shell"><div class="top"><div><a class="back" href="/">← panel</a><h1>${escapeHtml(title)}</h1><div class="subtitle">${escapeHtml(subtitle)}</div></div></div><div class="layout"><aside class="side"><div class="box"><h2>Document metadata</h2>${meta || '<div class="empty">No frontmatter metadata</div>'}</div><div class="box"><h2>On this page</h2><nav class="toc">${toc || '<div class="empty">No headings</div>'}</nav></div></aside><article class="article">${rendered.html}</article></div></div><script>if(window.mermaid){mermaid.initialize({startOnLoad:true,theme:'base',themeVariables:{primaryColor:'#dff8e8',primaryTextColor:'#102018',primaryBorderColor:'#87d6ad',lineColor:'#315045',secondaryColor:'#e8f4ff',tertiaryColor:'#fff7db'}});}</script></body></html>`;
}

function memoryHtml(context: string | undefined, slug: string, title: string | undefined, content: string): string {
  return documentHtml(title ?? slug, `Spec Context Project: ${context ?? "workspace"} · product memory: ${slug}`, content);
}

function specMemoryHtml(context: string, file: string, content: string): string {
  return documentHtml(file, `Spec Context Project: ${context}`, content);
}

function indexHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>dadaia-pi panel</title>
<style>
:root{color-scheme:dark;--bg:#111816;--card:#18231f;--muted:#9fb3aa;--text:#eef8f2;--line:#2b4038;--accent:#87d6ad;--warn:#f0c36a;--bad:#ff8b8b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}header{padding:24px 28px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,#13201b,#111816)}h1{margin:0;font-size:24px}.sub{color:var(--muted);margin-top:4px}.tabs{display:flex;gap:8px;padding:12px 24px;border-bottom:1px solid var(--line);position:sticky;top:0;background:#111816cc;backdrop-filter:blur(8px)}button{background:var(--card);border:1px solid var(--line);color:var(--text);padding:8px 12px;border-radius:10px;cursor:pointer}button.active{border-color:var(--accent);color:var(--accent)}main{padding:24px;display:grid;gap:18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.stack{display:grid;gap:18px}.layer{display:grid;gap:12px}.layer-title{margin:0;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}.overview-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.overview-tile{min-height:auto}.overview-tile h2{font-size:18px;margin:12px 0 0;overflow-wrap:anywhere}.project-list,.workflow-list,.report-list{display:grid;gap:12px}.project-card{display:grid;grid-template-columns:minmax(220px,1fr) minmax(260px,1.1fr) minmax(320px,1.6fr);gap:18px;align-items:start}.workflow-card{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(280px,1fr) minmax(460px,2fr);gap:18px;align-items:start}.workflow-state-card{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(260px,1fr) minmax(320px,1.4fr);gap:18px;align-items:start}.report-card{display:grid;grid-template-columns:minmax(180px,.7fr) minmax(420px,2fr) minmax(180px,.6fr);gap:18px;align-items:center}.project-card h2,.workflow-card h2,.workflow-state-card h2{margin:0 0 10px}.project-card h3,.workflow-card h3,.workflow-state-card h3,.report-card h3{margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.step-strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}.step{flex:0 0 240px;border:1px solid var(--line);border-radius:12px;padding:10px;background:#101916}.step strong{display:block}.step span{display:block;color:var(--muted);font-size:12px;margin-top:4px}.pill-row{display:flex;gap:8px;flex-wrap:wrap}.pill{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;padding:5px 9px;background:#0f1714;text-decoration:none}.feature-list{margin:0;padding-left:18px;max-height:140px;overflow:auto}.feature-list li{margin:0 0 6px}.feature-tldr{display:block;color:var(--muted);font-size:12px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:0 6px 24px #0004}.muted{color:var(--muted)}.ok{color:var(--accent)}.warn{color:var(--warn)}.bad{color:var(--bad)}pre{white-space:pre-wrap;overflow:auto;background:#0b100e;border:1px solid var(--line);border-radius:12px;padding:12px}.hidden{display:none}a{color:var(--accent)}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid var(--line);text-align:left}@media (max-width:1100px){.overview-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.project-card,.workflow-card,.workflow-state-card,.report-card{grid-template-columns:1fr}}@media (max-width:640px){.overview-strip{grid-template-columns:1fr}}</style>
</head>
<body>
<header><h1>dadaia-pi workspace panel</h1><div class="sub">local loopback dashboard · read-only · Pi-native</div></header>
<nav class="tabs">
<button data-tab="projects" class="active">Projects</button>
<button data-tab="handoffs">Handoffs</button>
<button data-tab="workflows">Workflows</button>
<button data-tab="reports">Reports</button>
<button data-tab="raw">Raw</button>
</nav>
<main>
<section id="projects" class="tab"><div class="stack" id="projects-stack"></div></section>
<section id="handoffs" class="tab hidden"><div class="card"><table><thead><tr><th>Context</th><th>Verdict</th><th>Agent</th><th>Produced</th><th>Path</th></tr></thead><tbody id="handoffs-table"></tbody></table></div></section>
<section id="workflows" class="tab hidden"><div id="workflows-list" class="stack"></div></section>
<section id="reports" class="tab hidden"><div id="reports-list" class="stack"></div></section>
<section id="raw" class="tab hidden"><pre id="raw-json">loading...</pre></section>
</main>
<script>
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for (const b of document.querySelectorAll('button[data-tab]')) b.onclick = () => { for (const x of document.querySelectorAll('button[data-tab]')) x.classList.toggle('active', x===b); for (const s of document.querySelectorAll('.tab')) s.classList.toggle('hidden', s.id!==b.dataset.tab); };
async function get(path){ const r = await fetch(path); if(!r.ok) throw new Error(path + ' -> ' + r.status); return r.json(); }
async function boot(){
  const [health,status,handoffs,workflows,workflowDefinitions,reports] = await Promise.all([get('/health'),get('/api/status'),get('/api/handoffs'),get('/api/workflows'),get('/api/workflow-definitions'),get('/api/reports')]);
  const memoryGroups = await Promise.all(status.contexts.map(async c => ({ context: c.name, entries: await get('/api/memory?context=' + encodeURIComponent(c.name)).catch(() => []) })));
  const memory = memoryGroups.flatMap(g => g.entries.map(m => ({...m, context: g.context})));
  const overviewCards = [
    ['Workspace', status.root], ['Doctor', status.doctor.errors + ' error(s), ' + status.doctor.warnings + ' warning(s)'], ['Spec Context Projects', status.contexts.length], ['Version', health.version]
  ].map(([k,v]) => '<div class="card overview-tile"><div class="muted">'+esc(k)+'</div><h2>'+esc(v)+'</h2></div>').join('');
  const productByContext = Object.fromEntries(memoryGroups.map(g => [g.context, g.entries]));
  const projectCards = status.contexts.map(c => {
    const product = productByContext[c.name] || [];
    const required = [
      '<a class="pill" href="/constitution?context='+encodeURIComponent(c.name)+'">Constitution</a>',
      ['Architecture','architecture.md'],
      ['quality-assurance','quality-assurance.md'],
      ['product catalog','product/catalog.json']
    ].map(item => Array.isArray(item) ? '<a class="pill" href="/spec-memory?context='+encodeURIComponent(c.name)+'&file='+encodeURIComponent(item[1])+'">'+esc(item[0])+'</a>' : item).join('');
    const productLinks = product.map(m => '<li><a href="/memory/'+encodeURIComponent(m.slug)+'?context='+encodeURIComponent(c.name)+'">'+esc(m.title||m.slug)+'</a><span class="feature-tldr">'+esc(m.tldr||'')+'</span></li>').join('') || '<li class="muted">no product memory catalog entries</li>';
    return '<article class="card project-card"><div><h2>'+esc(c.name)+'</h2><p class="muted">'+esc(c.state)+' · repo='+esc(c.repoSlug)+' · branch='+esc(c.branch)+'</p><p>'+esc((c.evidence?.handoffs??0)+' handoffs / '+(c.evidence?.reports??0)+' reports')+'</p></div><div><h3>Required spec memory</h3><div class="pill-row">'+required+'</div></div><div><h3>Product feature memory</h3><ul class="feature-list">'+productLinks+'</ul></div></article>';
  }).join('') || '<div class="card muted">No Spec Context Projects</div>';
  document.getElementById('projects-stack').innerHTML = '<div class="layer"><h2 class="layer-title">Workspace overview</h2><div class="overview-strip">'+overviewCards+'</div></div><div class="layer"><h2 class="layer-title">Spec Context Projects</h2><div class="project-list">'+projectCards+'</div></div>';
  document.getElementById('handoffs-table').innerHTML = handoffs.map(h => '<tr><td>'+esc(h.context)+'</td><td>'+esc(h.verdict)+'</td><td>'+esc(h.agent)+'</td><td>'+esc(h.producedAt)+'</td><td>'+esc(h.path)+'</td></tr>').join('') || '<tr><td colspan="5" class="muted">No handoffs</td></tr>';
  const workflowStateCards = workflows.contexts.map(w => '<article class="card workflow-state-card"><div><h2>'+esc(w.context)+'</h2><p class="muted">release='+esc(w.release)+'<br>phase='+esc(w.phase)+'</p></div><div><h3>Gates and task</h3><p>missing gates: '+esc((w.missingGates||[]).map(g=>g.name).join(', ')||'none')+'</p><p>active task: '+esc(w.activeTask||'none')+'</p><p>write set: '+esc((w.writeSet||[]).join(', ')||'none')+'</p></div><div><h3>Evidence</h3><p>RCs: '+esc((w.releaseCandidates||[]).map(r=>r.id+': qa='+r.reviews.qa+' sec='+r.reviews.security+' code='+r.reviews.code).join('; ')||'none')+'</p><p>latest manifests: '+esc((w.latestManifests||[]).join(', ')||'none')+'</p><pre>dadaia-pi workflow readiness --context '+esc(w.context)+' --release '+esc(w.release||'')+'</pre></div></article>').join('');
  const definitionCards = workflowDefinitions.map(d => '<article class="card workflow-card"><div><h2>'+esc(d.id)+'</h2><p class="muted">'+esc(d.phase)+'<br>'+esc(d.activity)+'<br>engine='+esc(d.orchestration?.engine || 'sdk')+'</p></div><div><h3>Purpose</h3><p>'+esc(d.purpose)+'</p></div><div><h3>Procedural steps</h3><div class="step-strip">'+(d.orchestration?.steps||[]).map(s => '<div class="step"><strong>'+esc(s.title)+'</strong><span>'+esc(s.kind)+(s.model?' · model='+esc(s.model):'')+(s.maxIterations?' · max='+esc(s.maxIterations):'')+(s.requiresApproval?' · approval':'')+'</span><span>'+esc(s.description)+'</span></div>').join('')+'</div></div></article>').join('');
  document.getElementById('workflows-list').innerHTML = '<div class="layer"><h2 class="layer-title">Active workflow state</h2><div class="workflow-list">'+workflowStateCards+'</div></div><div class="layer"><h2 class="layer-title">Workflow catalog and enforced steps</h2><div class="workflow-list">'+definitionCards+'</div></div>' + (workflows.doctorIssues.length ? '<div class="card bad"><h2>Workflow doctor issues</h2><pre>'+esc(JSON.stringify(workflows.doctorIssues,null,2))+'</pre></div>' : '');
  const reportsByContext = reports.contexts.map(group => '<div class="layer"><h2 class="layer-title">'+esc(group.context)+'</h2><div class="report-list">'+(group.reports||[]).map(r => '<article class="card report-card"><div><h3>'+esc(r.kind)+'</h3><p class="muted">'+esc(r.modifiedAt||'')+'</p></div><div><a href="/report?path='+encodeURIComponent(r.path)+'">'+esc(r.title||r.name)+'</a><p class="muted">'+esc(r.path)+'</p></div><div class="pill-row"><a class="pill" href="/report?path='+encodeURIComponent(r.path)+'">Open report</a></div></article>').join('')+'</div></div>').join('') || '<div class="card muted">No reports</div>';
  document.getElementById('reports-list').innerHTML = reportsByContext;
  document.getElementById('raw-json').textContent = JSON.stringify({health,status,memory,handoffs,workflows,workflowDefinitions,reports}, null, 2);
}
boot().catch(e => { document.getElementById('projects-stack').innerHTML = '<div class="card bad">'+esc(e.message)+'</div>'; });
</script>
</body>
</html>`;
}

async function readActive(root: string, repoSlug: string): Promise<{ release?: string; phase?: string }> {
  try {
    const text = await readFile(join(root, "repos", repoSlug, "specs", "releases", "ACTIVE.md"), "utf8");
    const release = /^release:\s*(.+)$/m.exec(text)?.[1]?.trim();
    const phase = /^phase:\s*(.+)$/m.exec(text)?.[1]?.trim();
    return { ...(release ? { release } : {}), ...(phase ? { phase } : {}) };
  } catch {
    return {};
  }
}

async function latestJsonFiles(dir: string, limit = 5): Promise<string[]> {
  try {
    return (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name).sort().slice(-limit);
  } catch {
    return [];
  }
}

async function workflowPanelSummary(root: string): Promise<unknown> {
  const status = await buildWorkspaceStatus(root);
  const doctor = await runWorkspaceDoctor(root);
  const contexts = [];
  for (const context of status.contexts) {
    const active = await readActive(root, context.repoSlug);
    const release = active.release;
    const repoRoot = join(root, "repos", context.repoSlug);
    const gateStatus = release ? await workflowGovernanceStatus(root, context.name, release).catch(() => undefined) : undefined;
    const writeSet = release ? await readReservedTaskWriteSet(repoRoot, release).catch(() => undefined) : undefined;
    const rcs = release ? await listReleaseCandidates(root, context.name, release).catch(() => []) : [];
    contexts.push({
      context: context.name,
      repoSlug: context.repoSlug,
      release,
      phase: active.phase,
      missingGates: gateStatus?.gates.filter((gate) => !gate.ok) ?? [],
      activeTask: writeSet?.taskLine,
      writeSet: writeSet?.patterns ?? [],
      releaseCandidates: rcs.map((rc) => ({ id: rc.id, commitRange: rc.commitRange, reviews: { qa: rc.reviews.qa.length, security: rc.reviews.security.length, code: rc.reviews.code.length } })),
      latestManifests: await latestJsonFiles(join(root, ".dadaia-pi", "workflows", context.name)),
      handoffs: (await listHandoffs(root, context.name)).slice(-5),
    });
  }
  return { contexts, doctorIssues: doctor.issues.filter((item) => item.code.startsWith("WORKFLOW") || item.code.startsWith("RC") || item.code.startsWith("HANDOFF")) };
}

interface PanelReportEntry {
  readonly context: string;
  readonly name: string;
  readonly path: string;
  readonly title: string;
  readonly kind: string;
  readonly modifiedAt: string;
}

async function collectReports(root: string, context: string, dir: string, prefix = ""): Promise<PanelReportEntry[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const reports: PanelReportEntry[] = [];
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      reports.push(...await collectReports(root, context, absolute, relativePath));
      continue;
    }
    if (!/\.(md|markdown|html|txt|json)$/i.test(entry.name)) continue;
    const workspacePath = `.dadaia-pi/reports/${context}/${relativePath}`;
    const info = await stat(absolute);
    reports.push({
      context,
      name: entry.name,
      path: workspacePath,
      title: entry.name.replace(/\.(md|markdown|html|txt|json)$/i, ""),
      kind: relativePath.includes("/") ? relativePath.split("/")[0] ?? "report" : "report",
      modifiedAt: info.mtime.toISOString(),
    });
  }
  return reports.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, 50);
}

async function reportPanelSummary(root: string): Promise<unknown> {
  const status = await buildWorkspaceStatus(root);
  const contexts = await Promise.all(status.contexts.map(async (context) => ({
    context: context.name,
    reports: await collectReports(root, context.name, join(root, ".dadaia-pi", "reports", context.name)),
  })));
  return { contexts };
}

function safeReportPath(root: string, reportPath: string): string {
  if (!reportPath.startsWith(".dadaia-pi/reports/") || reportPath.includes("..")) throw new Error("unsupported report path");
  return join(root, reportPath);
}

function openBrowser(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    // Best-effort only. The printed URL is the contract.
  }
}

export async function startPanelServer(root: string, options: PanelOptions = {}): Promise<RunningPanel> {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  if (host !== DEFAULT_HOST) throw new Error(`dadaia-pi panel supports loopback bind only. Got: ${host}`);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!isAllowedHost(req.headers.host, host)) {
        text(res, 403, "forbidden host\n");
        return;
      }
      const url = new URL(req.url ?? "/", `http://${host}:${port}`);
      if (req.method !== "GET") {
        text(res, 405, "method not allowed\n");
        return;
      }
      if (url.pathname === "/") {
        html(res, indexHtml());
        return;
      }
      if (url.pathname === "/health" || url.pathname === "/api/panel-status") {
        json(res, 200, { status: "ok", version: VERSION, root });
        return;
      }
      if (url.pathname === "/api/status" || url.pathname === "/api/contexts") {
        const status = await buildWorkspaceStatus(root);
        json(res, 200, url.pathname === "/api/contexts" ? status.contexts : status);
        return;
      }
      if (url.pathname === "/api/memory") {
        json(res, 200, await listMemoryCatalog(root, url.searchParams.get("context") ?? undefined));
        return;
      }
      if (url.pathname.startsWith("/api/memory/")) {
        const slug = decodeURIComponent(url.pathname.slice("/api/memory/".length));
        json(res, 200, await showMemoryAtom(root, slug, url.searchParams.get("context") ?? undefined));
        return;
      }
      if (url.pathname.startsWith("/memory/")) {
        const slug = decodeURIComponent(url.pathname.slice("/memory/".length));
        const context = url.searchParams.get("context") ?? undefined;
        const atom = await showMemoryAtom(root, slug, context);
        html(res, memoryHtml(context, slug, atom.title, atom.content));
        return;
      }
      if (url.pathname === "/spec-memory") {
        const contextName = url.searchParams.get("context") ?? "";
        const file = url.searchParams.get("file") ?? "";
        if (!/^(architecture\.md|quality-assurance\.md|product\/catalog\.json)$/.test(file)) {
          text(res, 400, "unsupported spec memory file\n");
          return;
        }
        const status = await buildWorkspaceStatus(root);
        const context = status.contexts.find((item) => item.name === contextName);
        if (!context) {
          text(res, 404, "context not found\n");
          return;
        }
        const content = await readFile(join(root, "repos", context.repoSlug, "specs", "memory", file), "utf8");
        html(res, specMemoryHtml(contextName, file, content));
        return;
      }
      if (url.pathname === "/constitution") {
        const contextName = url.searchParams.get("context") ?? "";
        const status = await buildWorkspaceStatus(root);
        const context = status.contexts.find((item) => item.name === contextName);
        if (!context) {
          text(res, 404, "context not found\n");
          return;
        }
        const content = await readFile(join(root, "repos", context.repoSlug, "specs", "constitution.md"), "utf8");
        html(res, documentHtml("Constitution", `Spec Context Project: ${contextName}`, content));
        return;
      }
      if (url.pathname === "/api/handoffs") {
        json(res, 200, await listHandoffs(root, url.searchParams.get("context") ?? undefined));
        return;
      }
      if (url.pathname === "/api/workflows") {
        json(res, 200, await workflowPanelSummary(root));
        return;
      }
      if (url.pathname === "/api/workflow-definitions") {
        json(res, 200, listWorkflowDefinitions());
        return;
      }
      if (url.pathname === "/api/reports") {
        json(res, 200, await reportPanelSummary(root));
        return;
      }
      if (url.pathname === "/report") {
        const reportPath = url.searchParams.get("path") ?? "";
        const content = await readFile(safeReportPath(root, reportPath), "utf8");
        html(res, documentHtml(reportPath.split("/").pop() ?? "Report", reportPath, content));
        return;
      }
      if (url.pathname === "/api/doctor/run") {
        json(res, 200, await runWorkspaceDoctor(root));
        return;
      }
      if (url.pathname === "/api/workflow/status") {
        json(res, 200, await workflowGovernanceStatus(root, url.searchParams.get("context") ?? "", url.searchParams.get("release") ?? ""));
        return;
      }
      if (url.pathname === "/api/workflow/readiness") {
        json(res, 200, await workflowReadiness(root, url.searchParams.get("context") ?? "", url.searchParams.get("release") ?? ""));
        return;
      }
      if (url.pathname === "/api/workflow/rc") {
        json(res, 200, await inspectReleaseCandidate(root, url.searchParams.get("context") ?? "", url.searchParams.get("release") ?? "", url.searchParams.get("rc") ?? ""));
        return;
      }
      text(res, 404, "not found\n");
    } catch (error) {
      json(res, 500, { error: (error as Error).message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  const url = `http://${host}:${actualPort}/`;
  if (options.open) openBrowser(url);
  return { server, url };
}

export async function runPanel(root: string, options: PanelOptions = {}): Promise<void> {
  const panel = await startPanelServer(root, options);
  process.stdout.write(`Panel running at ${panel.url}\n`);
  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      panel.server.close(() => resolve());
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}
