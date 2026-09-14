/** Small dependency-free Chrome DevTools client for local browser regressions. */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ...[process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
      .filter(Boolean).flatMap((base) => [join(base, 'Google/Chrome/Application/chrome.exe'), join(base, 'Microsoft/Edge/Application/msedge.exe')]),
  ];
  const result = candidates.find((path) => path && existsSync(path));
  if (!result) throw new Error('Chrome/Chromium/Edge was not found. Set CHROME_PATH to its executable path.');
  return result;
}

class Connection {
  constructor(socket) {
    this.socket = socket; this.id = 0; this.pending = new Map();
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(String(data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id); clearTimeout(pending.timeout);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error))); else pending.resolve(message.result);
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(new Error('Browser connection closed.')); }
      this.pending.clear();
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async waitFor(expression, timeout = 15000) {
    const deadline = Date.now() + timeout;
    do { if (await this.evaluate(expression)) return; await delay(100); } while (Date.now() < deadline);
    throw new Error(`Browser condition not met: ${expression}`);
  }
  close() { this.socket.close(); }
}

export async function startChrome() {
  const profile = await mkdtemp(join(tmpdir(), 'meshtailor-chrome-'));
  const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', 'about:blank'];
  if (process.env.CHROME_SOFTWARE_WEBGL === '1') {
    args.unshift('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
    // A stale DISPLAY in Linux CI must not make SwiftShader require an X server.
    if (process.platform === 'linux') args.unshift('--ozone-platform=headless', '--use-gl=angle');
  }
  if (process.platform === 'linux' && process.getuid?.() === 0) args.unshift('--no-sandbox');
  let child;
  try { child = spawn(chromePath(), args, { stdio: ['ignore', 'ignore', 'pipe'] }); }
  catch (error) { await rm(profile, { recursive: true, force: true }); throw error; }
  let stderr = '';
  const ws = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`Chrome did not start: ${stderr}`)); }, 15000);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  }).catch(async (error) => { child.kill(); await rm(profile, { recursive: true, force: true }); throw error; });
  const socketUrl = new URL(ws);
  const base = `http://${socketUrl.host}`;
  const connections = [];
  return {
    diagnostics: () => stderr,
    async page() {
      const response = await fetch(`${base}/json/new?about:blank`, { method: 'PUT' });
      if (!response.ok) throw new Error(`Cannot create browser page: HTTP ${response.status}`);
      const target = await response.json();
      const socket = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
      const connection = new Connection(socket);
      connections.push(connection);
      await connection.send('Page.enable');
      await connection.send('Runtime.enable');
      return connection;
    },
    async close() {
      connections.forEach((connection) => connection.close());
      const exit = once(child, 'exit').catch(() => {});
      child.kill();
      await Promise.race([exit, delay(2000)]);
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
    },
  };
}
