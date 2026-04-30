/**
 * @file log-file.mjs
 * @description 日志文件写入、按天轮转、gzip 压缩归档、过期清理。
 *
 * 环境变量：
 *   LOG_FILE_ENABLED      - 是否启用（默认 true）
 *   LOG_FILE_DIR           - 日志目录（默认 ./logs）
 *   LOG_FILE_RETENTION_DAYS - 归档保留天数（默认 7）
 */

import { createWriteStream, mkdirSync, existsSync } from 'node:fs'
import { appendFile, readFile, writeFile, unlink, readdir, stat } from 'node:fs/promises'
import { gzip } from 'node:zlib'
import { join, extname } from 'node:path'

function dateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

function gzipBuf(buf) {
  return new Promise((resolve, reject) => {
    gzip(buf, (err, data) => (err ? reject(err) : resolve(data)))
  })
}

export function createFileLogger({
  enabled = (process.env.LOG_FILE_ENABLED || 'true') !== 'false',
  dir = process.env.LOG_FILE_DIR || './logs',
  retentionDays = Number(process.env.LOG_FILE_RETENTION_DAYS || 7),
} = {}) {
  if (!enabled) return { write() {}, cleanup() {} }

  mkdirSync(dir, { recursive: true })
  let currentDate = dateStr()
  let stream = null
  let cleanupTimer = null

  function getStream() {
    if (!stream) {
      const p = join(dir, `server-${currentDate}.log`)
      stream = createWriteStream(p, { flags: 'a' })
    }
    return stream
  }

  function rotate() {
    if (!stream) return
    const oldPath = join(dir, `server-${currentDate}.log`)
    stream.end(() => {
      compressFile(oldPath).catch(() => {})
    })
    stream = null
  }

  async function compressFile(filePath) {
    try {
      const content = await readFile(filePath)
      const compressed = await gzipBuf(content)
      await writeFile(filePath + '.gz', compressed)
      await unlink(filePath)
    } catch {
      /* 压缩失败不影响服务 */
    }
  }

  function write(level, message, meta = {}) {
    const today = dateStr()
    if (today !== currentDate) {
      rotate()
      currentDate = today
    }

    const record = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg: stripAnsi(message),
      ...meta,
    }) + '\n'

    // 用 appendFile 而非 stream，避免并发写入撕裂，同时避免 EMFILE
    appendFile(join(dir, `server-${currentDate}.log`), record).catch(() => {})
  }

  async function cleanup() {
    // 启动时：压缩所有未压缩的历史日志，清理过期归档
    try {
      const files = await readdir(dir)
      const cutoff = Date.now() - retentionDays * 86_400_000

      for (const name of files) {
        const fp = join(dir, name)
        const st = await stat(fp).catch(() => null)
        if (!st) continue

        // 压缩未打包的历史 .log（不含今天的）
        if (name.endsWith('.log') && !name.includes(currentDate)) {
          await compressFile(fp)
          continue
        }

        // 删除过期 .gz
        if (name.endsWith('.gz') && st.mtimeMs < cutoff) {
          await unlink(fp).catch(() => {})
        }
      }
    } catch {
      /* cleanup 失败不影响服务 */
    }

    // 定时清理（每小时一次）
    cleanupTimer = setInterval(async () => {
      try {
        const files = await readdir(dir)
        const cutoff = Date.now() - retentionDays * 86_400_000
        for (const name of files) {
          if (name.endsWith('.gz')) {
            const fp = join(dir, name)
            const st = await stat(fp).catch(() => null)
            if (st && st.mtimeMs < cutoff) {
              await unlink(fp).catch(() => {})
            }
          }
        }
      } catch {}
    }, 3_600_000)
    cleanupTimer.unref()
  }

  return { write, cleanup }
}
