import { NextResponse } from 'next/server';
import os from 'os';
import { execSync } from 'child_process';
import http from 'http';

export const dynamic = 'force-dynamic';

/* ---------- CPU: two-sample delta approach ---------- */

let _prevCpu: { idle: number; total: number } | null = null;

function getCpuPercent(): { percent: number; cores: number } {
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

  // First call — try macOS `top` for instant reading, else return snapshot
  _prevCpu = { idle: totalIdle, total: totalTick };

  try {
    const raw = execSync('top -l 1 -n 0 -s 0 2>/dev/null | grep "CPU usage"', {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    // "CPU usage: 12.34% user, 5.67% sys, 81.99% idle"
    const idleMatch = raw.match(/([\d.]+)%\s*idle/);
    if (idleMatch) {
      const idlePct = parseFloat(idleMatch[1]);
      return { percent: +(100 - idlePct).toFixed(1), cores };
    }
  } catch {
    // fall through
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

/* ---------- Swap ---------- */

function getSwap(): { usedBytes: number; totalBytes: number; percent: number } {
  try {
    const raw = execSync('sysctl vm.swapusage', { encoding: 'utf-8' }).trim();
    const parseM = (label: string): number => {
      const re = new RegExp(`${label}\\s*=\\s*([\\d.]+)M`);
      const m = raw.match(re);
      return m ? parseFloat(m[1]) * 1024 * 1024 : 0;
    };
    const totalBytes = parseM('total');
    const usedBytes = parseM('used');
    const percent = totalBytes > 0 ? +((usedBytes / totalBytes) * 100).toFixed(1) : 0;
    return { usedBytes, totalBytes, percent };
  } catch {
    return { usedBytes: 0, totalBytes: 0, percent: 0 };
  }
}

/* ---------- Disk ---------- */

function getDisk(): { path: string; usedBytes: number; totalBytes: number; percent: number } {
  try {
    const raw = execSync('df -k /', { encoding: 'utf-8' });
    const lines = raw.trim().split('\n');
    const parts = lines[1].split(/\s+/);
    const totalBytes = parseInt(parts[1], 10) * 1024;
    const usedBytes = parseInt(parts[2], 10) * 1024;
    const percent = totalBytes > 0 ? +((usedBytes / totalBytes) * 100).toFixed(1) : 0;
    return { path: '/', usedBytes, totalBytes, percent };
  } catch {
    return { path: '/', usedBytes: 0, totalBytes: 0, percent: 0 };
  }
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

function tryGatewayHosts(
  hostnames: string[],
  port: number,
): Promise<{ status: string; pid: number | null; uptime: string; memory: string }> {
  const [hostname, ...rest] = hostnames;
  if (!hostname) {
    // All hostnames exhausted — try pgrep as last resort
    try {
      const pidRaw = execSync('pgrep -f openclaw-gateway', { encoding: 'utf-8' }).trim();
      const pid = parseInt(pidRaw.split('\n')[0], 10);
      if (!isNaN(pid)) {
        return Promise.resolve({ status: 'online', pid, uptime: '-', memory: '-' });
      }
    } catch {}
    return Promise.resolve({ status: 'offline', pid: null, uptime: '-', memory: '-' });
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
        res.on('end', () => {
          // Gateway responded — it's online
          let pid: number | null = null;
          try {
            const data = JSON.parse(body);
            pid = data.pid || null;
          } catch {
            // healthz might return non-JSON, that's fine
          }

          // Try to get process info via pgrep as supplement
          let uptime = '-';
          let memory = '-';
          try {
            const pidRaw = execSync('pgrep -f openclaw-gateway', { encoding: 'utf-8' }).trim();
            const gwPid = parseInt(pidRaw.split('\n')[0], 10);
            if (!isNaN(gwPid)) {
              pid = gwPid;
              try {
                const psRaw = execSync(`ps -p ${gwPid} -o etime=,rss=`, { encoding: 'utf-8' }).trim();
                const psParts = psRaw.split(/\s+/);
                uptime = psParts[0] || '-';
                const rssKb = parseInt(psParts[1] || '0', 10);
                memory = `${(rssKb / 1024).toFixed(0)} MB`;
              } catch {}
            }
          } catch {}

          resolve({ status: 'online', pid, uptime, memory });
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

function getOpenClawVersion(): string {
  try {
    const raw = execSync('openclaw --version 2>/dev/null', { encoding: 'utf-8', timeout: 3000 }).trim();
    return raw;
  } catch {}

  try {
    const home = os.homedir();
    const raw = execSync(`cat ${home}/.openclaw/openclaw.json`, { encoding: 'utf-8' });
    const cfg = JSON.parse(raw);
    if (cfg.version) return cfg.version;
  } catch {}

  return 'unknown';
}

/* ---------- Route handler ---------- */

export async function GET() {
  try {
    const cpu = getCpuPercent();
    const ram = getRam();
    const swap = getSwap();
    const disk = getDisk();
    const gatewayPort = parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10);
    const gateway = await checkGatewayHttp(gatewayPort);
    const openclaw = getOpenClawVersion();

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
