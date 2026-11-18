import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = process.cwd();
const INCLUDE_DIRS = ["src", "scripts", "docs", "public", "agent", ".github"];
const INCLUDE_FILES = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next.config.ts",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "drizzle.config.json",
  ".env.example",
  "KURULUM.bat",
  "Arena-Agent.bat",
  "README.md",
];
const SKIP = new Set(["node_modules", ".next", ".git", "release", "logs", ".turbo", "tsconfig.tsbuildinfo"]);

const LAUNCHER = `@echo off
chcp 65001 >nul
title Arena Live OS
cd /d "%~dp0"
if not exist node_modules (
  echo Bagimliliklar kuruluyor...
  call npm ci
)
if not exist .env copy .env.example .env
if not exist .next (
  echo Production build aliniyor...
  call npm run build
)
start "" http://localhost:3000
echo [agent] GitHub degisiklikleri kontrol edilip agent baslatiliyor...
call Arena-Agent.bat
call npm run start
pause
`;

const AGENT_BAT = `@echo off
chcp 65001 >nul
title Arena Agent
cd /d "%~dp0"
node agent/update.mjs
node agent/arena-agent.mjs
pause
`;

const STOP = `@echo off
title Arena Live OS - Durdur
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a
echo Arena Live OS durduruldu.
timeout /t 2 >nul
`;

const README = `# Arena Live OS — Windows Paketi
TikTok LIVE ajans isletim sistemi. Kurulum: KURULUM.bat -> Arena-Live-OS.bat
Detayli rehber: docs/WINDOWS-KURULUM.md
Gereksinim: Node.js 20+, PostgreSQL 14+
Ilk veri: Invoke-RestMethod -Method Post http://localhost:3000/api/demo/seed
`;

async function addDirectory(zip: JSZip, relative: string) {
  const absolute = path.join(ROOT, relative);
  let entries: string[] = [];
  try {
    entries = await readdir(absolute);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP.has(entry) || entry.endsWith(".log")) continue;
    const rel = `${relative}/${entry}`;
    const info = await stat(path.join(ROOT, rel));
    if (info.isDirectory()) {
      await addDirectory(zip, rel);
    } else if (info.size < 4_500_000) {
      zip.file(rel, await readFile(path.join(ROOT, rel)));
    }
  }
}

export async function GET() {
  try {
    const zip = new JSZip();
    const base = "Arena-Live-OS";

    for (const dir of INCLUDE_DIRS) {
      await addDirectory(zip, dir);
    }
    for (const file of INCLUDE_FILES) {
      try {
        zip.file(file, await readFile(path.join(ROOT, file)));
      } catch {
        /* dosya opsiyonel */
      }
    }

    zip.file("Arena-Live-OS.bat", LAUNCHER);
    zip.file("Arena-Agent.bat", AGENT_BAT);
    zip.file("Durdur.bat", STOP);
    zip.file("README-WINDOWS.md", README);
    zip.file(
      "SURUM.txt",
      [
        "Arena Live OS 1.2.0 — GitHub auto-update agent + 7/24 Actions collector + SSE anlık sandık",
        `Paketlenme: ${new Date().toISOString()}`,
        "Node: 20+ (onerilen 22 LTS)",
        "Icerir: Next.js panel, Drizzle semasi, tiktok-live-connector, overlay kutuphanesi, Windows kurulum betikleri",
        "Kurulum: KURULUM.bat",
      ].join("\n"),
    );
    zip.file(
      "package-scripts.json",
      JSON.stringify(
        {
          scripts: {
            "windows:install": "powershell -ExecutionPolicy Bypass -File scripts/install-windows.ps1",
            "windows:start": "powershell -ExecutionPolicy Bypass -File scripts/start-windows.ps1",
            "windows:bundle": "node scripts/build-exe.js",
            "db:push": "drizzle-kit push",
          },
        },
        null,
        2,
      ),
    );

    const buffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    return new Response(new Blob([buffer as unknown as ArrayBuffer]), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="Arena-Live-OS-windows.zip"',
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
