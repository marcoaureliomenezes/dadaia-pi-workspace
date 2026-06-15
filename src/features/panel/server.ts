import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { isIP } from "node:net";

import { buildWorkspaceStatus } from "../status/index.js";
import { listMemoryCatalog, showMemoryAtom } from "../memory/index.js";
import { listHandoffs } from "../handoff/index.js";
import { VERSION } from "../../core/version.js";

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
    "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
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

function memoryHtml(context: string | undefined, slug: string, title: string | undefined, content: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title ?? slug)} · dadaia-pi memory</title><style>body{margin:0;background:#111816;color:#eef8f2;font:15px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:980px;margin:0 auto;padding:28px}a{color:#87d6ad}.muted{color:#9fb3aa}pre{white-space:pre-wrap;background:#0b100e;border:1px solid #2b4038;border-radius:14px;padding:18px;overflow:auto}</style></head><body><main><p><a href="/">← panel</a></p><h1>${escapeHtml(title ?? slug)}</h1><p class="muted">context=${escapeHtml(context ?? "workspace")} · slug=${escapeHtml(slug)}</p><pre>${escapeHtml(content)}</pre></main></body></html>`;
}

function indexHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>dadaia-pi panel</title>
<style>
:root{color-scheme:dark;--bg:#111816;--card:#18231f;--muted:#9fb3aa;--text:#eef8f2;--line:#2b4038;--accent:#87d6ad;--warn:#f0c36a;--bad:#ff8b8b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}header{padding:24px 28px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,#13201b,#111816)}h1{margin:0;font-size:24px}.sub{color:var(--muted);margin-top:4px}.tabs{display:flex;gap:8px;padding:12px 24px;border-bottom:1px solid var(--line);position:sticky;top:0;background:#111816cc;backdrop-filter:blur(8px)}button{background:var(--card);border:1px solid var(--line);color:var(--text);padding:8px 12px;border-radius:10px;cursor:pointer}button.active{border-color:var(--accent);color:var(--accent)}main{padding:24px;display:grid;gap:18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:0 6px 24px #0004}.muted{color:var(--muted)}.ok{color:var(--accent)}.warn{color:var(--warn)}.bad{color:var(--bad)}pre{white-space:pre-wrap;overflow:auto;background:#0b100e;border:1px solid var(--line);border-radius:12px;padding:12px}.hidden{display:none}a{color:var(--accent)}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid var(--line);text-align:left}</style>
</head>
<body>
<header><h1>dadaia-pi workspace panel</h1><div class="sub">local loopback dashboard · read-only · Pi-native</div></header>
<nav class="tabs">
<button data-tab="overview" class="active">Overview</button>
<button data-tab="contexts">Contexts</button>
<button data-tab="memory">Memory</button>
<button data-tab="handoffs">Handoffs</button>
<button data-tab="raw">Raw</button>
</nav>
<main>
<section id="overview" class="tab"><div class="grid" id="overview-grid"></div></section>
<section id="contexts" class="tab hidden"><div class="card"><table><thead><tr><th>Name</th><th>State</th><th>Repo</th><th>Branch</th><th>Evidence</th></tr></thead><tbody id="contexts-table"></tbody></table></div></section>
<section id="memory" class="tab hidden"><div class="card"><table><thead><tr><th>Context</th><th>Slug</th><th>Title</th><th>TLDR</th></tr></thead><tbody id="memory-table"></tbody></table></div></section>
<section id="handoffs" class="tab hidden"><div class="card"><table><thead><tr><th>Context</th><th>Verdict</th><th>Agent</th><th>Produced</th><th>Path</th></tr></thead><tbody id="handoffs-table"></tbody></table></div></section>
<section id="raw" class="tab hidden"><pre id="raw-json">loading...</pre></section>
</main>
<script>
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for (const b of document.querySelectorAll('button[data-tab]')) b.onclick = () => { for (const x of document.querySelectorAll('button[data-tab]')) x.classList.toggle('active', x===b); for (const s of document.querySelectorAll('.tab')) s.classList.toggle('hidden', s.id!==b.dataset.tab); };
async function get(path){ const r = await fetch(path); if(!r.ok) throw new Error(path + ' -> ' + r.status); return r.json(); }
async function boot(){
  const [health,status,handoffs] = await Promise.all([get('/health'),get('/api/status'),get('/api/handoffs')]);
  const memoryGroups = await Promise.all(status.contexts.map(async c => ({ context: c.name, entries: await get('/api/memory?context=' + encodeURIComponent(c.name)).catch(() => []) })));
  const memory = memoryGroups.flatMap(g => g.entries.map(m => ({...m, context: g.context})));
  document.getElementById('overview-grid').innerHTML = [
    ['Workspace', status.root], ['Doctor', status.doctor.errors + ' error(s), ' + status.doctor.warnings + ' warning(s)'], ['Contexts', status.contexts.length], ['Version', health.version]
  ].map(([k,v]) => '<div class="card"><div class="muted">'+esc(k)+'</div><h2>'+esc(v)+'</h2></div>').join('');
  document.getElementById('contexts-table').innerHTML = status.contexts.map(c => '<tr><td>'+esc(c.name)+'</td><td>'+esc(c.state)+'</td><td>'+esc(c.repoSlug)+'</td><td>'+esc(c.branch)+'</td><td>'+esc((c.evidence?.handoffs??0)+' handoffs / '+(c.evidence?.reports??0)+' reports')+'</td></tr>').join('') || '<tr><td colspan="5" class="muted">No contexts</td></tr>';
  document.getElementById('memory-table').innerHTML = memory.map(m => '<tr><td>'+esc(m.context)+'</td><td><a href="/memory/'+encodeURIComponent(m.slug)+'?context='+encodeURIComponent(m.context)+'">'+esc(m.slug)+'</a></td><td>'+esc(m.title)+'</td><td>'+esc(m.tldr)+'</td></tr>').join('') || '<tr><td colspan="4" class="muted">No memory catalog</td></tr>';
  document.getElementById('handoffs-table').innerHTML = handoffs.map(h => '<tr><td>'+esc(h.context)+'</td><td>'+esc(h.verdict)+'</td><td>'+esc(h.agent)+'</td><td>'+esc(h.producedAt)+'</td><td>'+esc(h.path)+'</td></tr>').join('') || '<tr><td colspan="5" class="muted">No handoffs</td></tr>';
  document.getElementById('raw-json').textContent = JSON.stringify({health,status,memory,handoffs}, null, 2);
}
boot().catch(e => { document.getElementById('overview-grid').innerHTML = '<div class="card bad">'+esc(e.message)+'</div>'; });
</script>
</body>
</html>`;
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
      if (url.pathname === "/api/handoffs") {
        json(res, 200, await listHandoffs(root, url.searchParams.get("context") ?? undefined));
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
