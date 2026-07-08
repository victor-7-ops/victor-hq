import { NextResponse } from 'next/server';
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import http from 'http';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);
const IS_WIN = process.platform === 'win32';

/* ---------- CPU: two-sample delta approach ---------- */

let _prevCpu: { idle: number; total: number } | null = null;

async function getCpuPercent(): Promise<{ percent: number; cores: number }> {
  const cpus = os.cpus();
  const cores = cpus.length;

  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    const { user, nice, sys, idle, irq } = cpu.times;
    totalTick += user + nice + sys + idle + irq;
    totalIdle += idle;
  }

  if (_prevCpu) {
    const idleDelta = totalIdle - _prevCpu.idle;
    const totalDelta = totalTick - _prevCpu.total;
    const percent = totalDelta > 0 ? +((1 - idleDelta / totalDelta) * 100).toFixed(1) : 0;
    _prevCpu = { idle: totalIdle, total: totalTick };
    return { percent, cores };
  }

  // First call — try a platform instant reading, else return snapshot
  _prevCpu = { idle: totalIdle, total: totalTick };

  if (!IS_WIN) {
    try {
      const { stdout } = await execAsync('top -l 1 -n 0 -s 0 2>/dev/null | grep "CPU usage"', {
        encoding: 'utf-8',
        timeout: 3000,
      });
      // "CPU usage: 12.34% user, 5.67% sys, 81.99% idle"
      const idleMatch = stdout.trim().match(/([\d.]+)%\s*idle/);
      if (idleMatch) {
        const idlePct = parseFloat(idleMatch[1]);
        return { percent: +(100 - idlePct).toFixed(1), cores };
      }
    } catch {
      // fall through
    }
  }

  const percent = +((1 - totalIdle / totalTick) * 100).toFixed(1);
  return { percent, cores };
}

/* ---------- RAM ---------- */

function getRam(): { usedBytes: number; totalBytes: number; percent: number } {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const percent = +((usedBytes / totalBytes) * 100).toFixed(1);
  return { usedBytes, totalBytes, percent };
}

type SwapDisk = {
  swap: { usedBytes: number; totalBytes: number; percent: number };
  disk: { path: string; usedBytes: number; totalBytes: number; percent: number };
};

const EMPTY_SWAP = { usedBytes: 0, totalBytes: 0, percent: 0 };
const emptyDisk = (path: string) => ({ path, usedBytes: 0, totalBytes: 0, percent: 0 });

/** Swap + disk in a single PowerShell invocation (one process spawn instead of two). */
async function getSwapAndDiskWindows(): Promise<SwapDisk> {
  const drive = (process.env.SystemDrive || 'C:').replace(/:$/, '');
  const diskPath = `${drive}:\\`;
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "` +
        `$p = Get-CimInstance Win32_PageFileUsage | Select-Object -First 1 AllocatedBaseSize,CurrentUsage; ` +
        `$d = Get-CimInstance Win32_LogicalDisk -Filter \\"DeviceID='${drive}:'\\" | Select-Object Size,FreeSpace; ` +
        `[PSCustomObject]@{ swap = $p; disk = $d } | ConvertTo-Json -Depth 4"`,
      { encoding: 'utf-8', timeout: 5000 },
    );
    const parsed = JSON.parse(stdout.trim());

    let swap = EMPTY_SWAP;
    if (parsed.swap) {
      const totalBytes = (parsed.swap.AllocatedBaseSize || 0) * 1024 * 1024;
      const usedBytes = (parsed.swap.CurrentUsage || 0) * 1024 * 1024;
      const percent = totalBytes > 0 ? +((usedBytes / totalBytes) * 100).toFixed(1) : 0;
      swap = { usedBytes, totalBytes, percent };
    }

    let disk = emptyDisk(diskPath);
    if (parsed.disk) {
      const totalBytes = Number(parsed.disk.Size) || 0;
      const freeBytes = Number(parsed.disk.FreeSpace) || 0;
      const usedBytes = totalBytes - freeBytes;
      const percent = totalBytes > 0 ? +((usedBytes / totalBytes) * 100).toFixed(1) : 0;
      disk = { path: diskPath, usedBytes, totalBytes, percent };
    }

    return { swap, disk };
  } catch {
    return { swap: EMPTY_SWAP, disk: emptyDisk(diskPath) };
  }
}

async function getSwapAndDiskDarwin(): Promise<SwapDisk> {
  let swap = EMPTY_SWAP;
  try {
    const { stdout } = await execAsync('sysctl vm.swapusage', { encoding: 'utf-8' });
    const raw = stdout.trim();
    const parseM = (label: string): number => {
      const re = new RegExp(`${label}\\s*=\\s*([\\d.]+)M`);
      const m = raw.match(re);
      return m ? parseFloat(m[1]) * 1024 * 1024 : 0;
    };
    const totalBytes = parseM('total');
    const usedBytes = parseM('used');
    const percent = totalBytes > 0 ? +((usedBytes / totalBytes) * 100).toFixed(1) : 0;
    swap = { usedBytes, totalBytes, percent };
  } catch {}

  let disk = emptyDisk('/');
  try {
    const { stdout } = await execAsync('df -k /', { encoding: 'utf-8' });
    const lines = stdout.trim().split('\n');
    const parts = lines[1].split(/\s+/);
    const totalBytes = parseInt(parts[1], 10) * 1024;
    const usedBytes = parseInt(parts[2], 10) * 1024;
    const percent = totalBytes > 0 ? +((usedBytes / totalBytes) * 100).toFixed(1) : 0;
    disk = { path: '/', usedBytes, totalBytes, percent };
  } catch {}

  return { swap, disk };
}

function getSwapAndDisk(): Promise<SwapDisk> {
  return IS_WIN ? getSwapAndDiskWindows() : getSwapAndDiskDarwin();
}

/* ---------- Gateway: HTTP health check ---------- */

function checkGatewayHttp(port: number): Promise<{
  status: string;
  pid: number | null;
  uptime: string;
  memory: string;
}> {
  // In Docker, use host.docker.internal to reach host services
  const hostnames = ['host.docker.internal', '127.0.0.1'];

  return tryGatewayHosts(hostnames, port);
}

/** Look up the gateway process's pid/uptime/memory via platform-native process tools. */
async function findGatewayProcessInfo(): Promise<{ pid: number | null; uptime: string; memory: string }> {
  if (IS_WIN) {
    try {
      const { stdout } = await execAsync(
        'powershell -NoProfile -NonInteractive -Command "Get-Process | Where-Object { $_.ProcessName -like \'*openclaw-gateway*\' } | Select-Object -First 1 Id,WorkingSet,StartTime | ConvertTo-Json"',
        { encoding: 'utf-8', timeout: 5000 },
      );
      const trimmed = stdout.trim();
      if (!trimmed) return { pid: null, uptime: '-', memory: '-' };
      const entry = JSON.parse(trimmed);
      const proc = Array.isArray(entry) ? entry[0] : entry;
      if (!proc) return { pid: null, uptime: '-', memory: '-' };
      const pid = Number(proc.Id) || null;
      const memory = proc.WorkingSet ? `${(Number(proc.WorkingSet) / 1024 / 1024).toFixed(0)} MB` : '-';
      let uptime = '-';
      if (proc.StartTime) {
        const started = new Date(proc.StartTime).getTime();
        if (!isNaN(started)) {
          const ms = Date.now() - started;
          const mins = Math.floor(ms / 60000);
          uptime = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${mins % 60}m`;
        }
      }
      return { pid, uptime, memory };
    } catch {
      return { pid: null, uptime: '-', memory: '-' };
    }
  }

  try {
    const { stdout: pidRaw } = await execAsync('pgrep -f openclaw-gateway', { encoding: 'utf-8' });
    const gwPid = parseInt(pidRaw.trim().split('\n')[0], 10);
    if (isNaN(gwPid)) return { pid: null, uptime: '-', memory: '-' };
    try {
      const { stdout: psRaw } = await execAsync(`ps -p ${gwPid} -o etime=,rss=`, { encoding: 'utf-8' });
      const psParts = psRaw.trim().split(/\s+/);
      const uptime = psParts[0] || '-';
      const rssKb = parseInt(psParts[1] || '0', 10);
      const memory = `${(rssKb / 1024).toFixed(0)} MB`;
      return { pid: gwPid, uptime, memory };
    } catch {
      return { pid: gwPid, uptime: '-', memory: '-' };
    }
  } catch {
    return { pid: null, uptime: '-', memory: '-' };
  }
}

function tryGatewayHosts(
  hostnames: string[],
  port: number,
): Promise<{ status: string; pid: number | null; uptime: string; memory: string }> {
  const [hostname, ...rest] = hostnames;
  if (!hostname) {
    // All hostnames exhausted — try platform process lookup as last resort
    return findGatewayProcessInfo().then((info) =>
      info.pid !== null
        ? { status: 'online', ...info }
        : { status: 'offline', pid: null, uptime: '-', memory: '-' },
    );
  }

  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname,
        port,
        path: '/healthz',
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', async () => {
          // Gateway responded — it's online
          let pid: number | null = null;
          try {
            const data = JSON.parse(body);
            pid = data.pid || null;
          } catch {
            // healthz might return non-JSON, that's fine
          }

          // Only shell out for process info if healthz didn't already give us a pid
          const info = pid === null ? await findGatewayProcessInfo() : null;
          if (info?.pid !== null && info?.pid !== undefined) pid = info.pid;

          resolve({ status: 'online', pid, uptime: info?.uptime ?? '-', memory: info?.memory ?? '-' });
        });
      }
    );

    req.on('error', () => {
      // This hostname failed — try next hostname
      tryGatewayHosts(rest, port).then(resolve);
    });

    req.on('timeout', () => {
      req.destroy();
      // This hostname timed out — try next hostname
      tryGatewayHosts(rest, port).then(resolve);
    });

    req.end();
  });
}

/* ---------- OpenClaw version ---------- */

async function getOpenClawVersion(): Promise<string> {
  try {
    const { stdout } = await execAsync('openclaw --version', { encoding: 'utf-8', timeout: 3000 });
    const trimmed = stdout.trim();
    if (trimmed) return trimmed;
  } catch {}

  try {
    const home = os.homedir();
    const raw = fs.readFileSync(`${home}/.openclaw/openclaw.json`, 'utf-8');
    const cfg = JSON.parse(raw);
    if (cfg.version) return cfg.version;
  } catch {}

  return 'unknown';
}

/* ---------- Route handler ---------- */

export async function GET() {
  try {
    const gatewayPort = parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10);
    const [cpu, swapDisk, gateway, openclaw] = await Promise.all([
      getCpuPercent(),
      getSwapAndDisk(),
      checkGatewayHttp(gatewayPort),
      getOpenClawVersion(),
    ]);
    const { swap, disk } = swapDisk;
    const ram = getRam();

    return NextResponse.json({
      ok: true,
      cpu,
      ram,
      swap,
      disk,
      versions: { openclaw, gateway },
      collectedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message, collectedAt: new Date().toISOString() },
      { status: 500 },
    );
  }
}
