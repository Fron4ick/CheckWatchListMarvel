#!/usr/bin/env node
// scripts/dev-clean.mjs — «чистый» запуск dev-сервера.
//
// Устраняет три причины рецидивов «белого экрана»:
//   1. Зависшие/дублирующиеся dev-серверы на порту 3000 (конкуренция за .next/dev,
//      десятки Turbopack-воркеров → OOM). Все процессы на порту прибиваются.
//   2. Повреждённый кэш .next (обрыв сборки, конфликт двух серверов) — удаляется.
//   3. Запуск «поверх» старого сервера — невозможен, так как порт освобождается заранее.
//
// Использование: npm run dev:clean
import { execFileSync, spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT || "3000";

function killOnPortWindows(port) {
  let count = 0;
  try {
    const out = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes(`:${port}`)) continue;
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execFileSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
        console.log(`  → убит процесс ${pid} (порт ${port})`);
        count += 1;
      } catch {
        // процесс уже завершён — не страшно
      }
    }
  } catch {
    // netstat недоступен — пропускаем
  }
  return count;
}

function killOnPortUnix(port) {
  let count = 0;
  try {
    const out = execFileSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf8" });
    for (const pid of out.split(/\s+/).filter(Boolean)) {
      try {
        execFileSync("kill", ["-9", pid], { stdio: "ignore" });
        console.log(`  → убит процесс ${pid} (порт ${port})`);
        count += 1;
      } catch {
        // процесс уже завершён
      }
    }
  } catch {
    // lsof недоступен или порт свободен
  }
  return count;
}

console.log("1/3 Освобождаю порт", PORT, "...");
const killed = process.platform === "win32" ? killOnPortWindows(PORT) : killOnPortUnix(PORT);

console.log("2/3 Удаляю кэш .next ...");
await rm(path.join(root, ".next"), { recursive: true, force: true });

if (killed > 0) {
  console.log(`Готово: убито ${killed} процесс(ов) на порту ${PORT}, кэш очищен.`);
} else {
  console.log("Готово: порт был свободен, кэш очищен.");
}

console.log("3/3 Запускаю npm run dev ...\n");
// На Windows (Node 22+) spawn пакетного файла (.cmd) без shell:true падает
// с EINVAL при запуске процесса с перенаправленным выводом (редактор/фон).
// Передаём единую строку с shell:true — это работает и в терминале, и в фоне,
// и не порождает предупреждение DEP0190 (оно возникает только при массиве args).
const child = spawn("npx next dev", { cwd: root, shell: true });
child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
if (process.stdin.isTTY) {
  process.stdin.setEncoding("utf8");
  process.stdin.pipe(child.stdin);
}
child.on("exit", (code) => process.exit(code ?? 0));