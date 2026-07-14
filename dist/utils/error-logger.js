/**
 * error-logger — Local trace logging + optional email notification on errors.
 *
 * Logs are written to .codesquad/logs/error-<date>.log in the project directory.
 * Email notification is configurable via .codesquad/settings.json.
 *
 * Settings (in .codesquad/settings.json → errorReporting):
 *   {
 *     "enabled": true,
 *     "email": {
 *       "to": "admin@example.com",
 *       "smtp": { "host": "smtp.example.com", "port": 587, "user": "...", "pass": "..." }
 *     }
 *   }
 */
import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { virtualExists, virtualReadFile } from '../embedded/virtual-fs.js';
import { isDebugMode } from './debug.js';
// ── State ──
let _config = null;
let _logDir = null;
// ── Init ──
export function initErrorLogger(projectRoot) {
    _logDir = join(projectRoot, '.codesquad', 'logs');
    mkdirSync(_logDir, { recursive: true });
    // Load config from .codesquad/settings.json (VirtualFS: embedded + disk)
    try {
        const settingsPath = join(projectRoot, '.codesquad', 'settings.json');
        if (virtualExists(settingsPath)) {
            const raw = virtualReadFile(settingsPath, 'utf-8');
            const settings = JSON.parse(raw);
            if (settings.errorReporting) {
                _config = settings.errorReporting;
            }
        }
    }
    catch {
        // Config is optional — logger works without it
    }
}
function getLogPath() {
    const dir = _logDir || join(process.cwd(), '.codesquad', 'logs');
    mkdirSync(dir, { recursive: true });
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return join(dir, `error-${date}.log`);
}
// ── Logging ──
/**
 * Write a diagnostic trace to the daily log file.
 * Levels: INFO, WARN, ERROR, FATAL, DEBUG.
 * This is the general-purpose file logger — use it anywhere you'd use console.log
 * so traces persist in .codesquad/logs/error-<date>.log even after terminal exits.
 */
export function logDiagnostic(level, source, message, context) {
    // DEBUG level only written when CODESQUAD_DEBUG=1
    if (level === 'DEBUG' && !isDebugMode())
        return;
    const logPath = getLogPath();
    const timestamp = new Date().toISOString();
    const ctx = context ? `\n  Context: ${JSON.stringify(context)}` : '';
    const line = `[${timestamp}] [${level}] [${source}] ${message}${ctx}\n`;
    try {
        appendFileSync(logPath, line, 'utf-8');
    }
    catch {
        // Best-effort — don't let logging failures cascade
    }
}
export function logError(report) {
    const logPath = getLogPath();
    const line = [
        `[${report.timestamp}] [${report.level}] [${report.source}]`,
        report.message,
        report.stack ? `\n  Stack: ${report.stack.replace(/\n/g, '\n  ')}` : '',
        report.context ? `\n  Context: ${JSON.stringify(report.context)}` : '',
        '\n---',
    ].join('');
    try {
        appendFileSync(logPath, line + '\n', 'utf-8');
    }
    catch {
        // Best-effort — don't let logging failures cascade
    }
}
/** Convenience: log an Error object with source context. */
export function logException(source, err, context) {
    logError({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        source,
        message: err.message,
        stack: err.stack,
        context,
    });
}
// ── Email Notification ──
/**
 * Read recent log entries for email body (last 50 lines).
 */
function getRecentLogs() {
    try {
        const logPath = getLogPath();
        if (!existsSync(logPath))
            return '(no recent logs)';
        const lines = readFileSync(logPath, 'utf-8').split('\n').slice(-50);
        return lines.join('\n');
    }
    catch {
        return '(failed to read logs)';
    }
}
/**
 * Send error report via email using SMTP.
 * Uses Node.js net module directly (no external dependency needed).
 */
async function sendEmail(config, subject, body) {
    try {
        // Dynamic import — nodemailer is optional (install: npm i nodemailer)
        let nodemailer;
        try {
            nodemailer = await Function('return import("nodemailer")')();
        }
        catch {
            return sendEmailFallback(config, subject, body);
        }
        const transporter = nodemailer.default.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure ?? (config.smtp.port === 465),
            auth: { user: config.smtp.user, pass: config.smtp.pass },
        });
        await transporter.sendMail({
            from: config.smtp.user,
            to: config.to,
            subject: `[CodeSquad Error] ${subject}`,
            text: body,
        });
        return true;
    }
    catch {
        return sendEmailFallback(config, subject, body);
    }
}
/** Fallback: use system mail / curl for environments without nodemailer. */
function sendEmailFallback(config, subject, body) {
    try {
        const { execSync } = require('child_process');
        const isWin = process.platform === 'win32';
        if (isWin) {
            // PowerShell Send-MailMessage (deprecated but widely available)
            // Escape all user-supplied values to prevent PowerShell injection.
            const esc = (s) => s.replace(/"/g, '\\"').replace(/\$/g, '`$');
            const psScript = `
        $smtpServer = "${esc(config.smtp.host)}"
        $smtpPort = ${config.smtp.port}
        $username = "${esc(config.smtp.user)}"
        $password = "${esc(config.smtp.pass)}"
        $to = "${esc(config.to)}"
        $subject = "${esc(subject)}"
        $body = @"\n${body}\n"@
        $secpasswd = ConvertTo-SecureString $password -AsPlainText -Force
        $cred = New-Object System.Management.Automation.PSCredential($username, $secpasswd)
        Send-MailMessage -From $username -To $to -Subject $subject -Body $body -SmtpServer $smtpServer -Port $smtpPort -UseSsl -Credential $cred
      `;
            execSync(`powershell -NoProfile -Command "${psScript}"`, { timeout: 15000, stdio: 'pipe' });
        }
        else {
            // Linux/Mac: try sendmail or mail
            const escapedBody = body.replace(/'/g, "'\\''");
            execSync(`echo '${escapedBody}' | mail -s "${subject}" "${config.to}"`, { timeout: 10000, stdio: 'pipe' });
        }
        return true;
    }
    catch {
        return false;
    }
}
// ── Public API ──
/**
 * Notify error to email (if configured).  Non-blocking, returns immediately.
 * Stores log to local file regardless of email success.
 */
export function notifyError(source, err, context) {
    // 1. Always write to local log file
    logException(source, err, context);
    // 2. Try email notification (fire-and-forget)
    if (_config?.enabled && _config.email) {
        const subject = `[${source}] ${err.message.substring(0, 80)}`;
        const body = [
            `CodeSquad Error Report`,
            `─────────────────────`,
            `Timestamp: ${new Date().toISOString()}`,
            `Source:    ${source}`,
            `Message:   ${err.message}`,
            err.stack ? `\nStack Trace:\n${err.stack}` : '',
            context ? `\nContext:\n${JSON.stringify(context, null, 2)}` : '',
            `\n─────────────────────`,
            `Recent Logs:`,
            getRecentLogs(),
        ].join('\n');
        // Fire-and-forget — don't block the main flow
        sendEmail(_config.email, subject, body).catch(() => {
            // Email failure is non-critical
        });
    }
}
//# sourceMappingURL=error-logger.js.map