const SECRET_PATTERNS = [
  {
    name: "named_secret_assignment",
    pattern: /\b(api[_-]?key|secret|password|passwd|access[_-]?token|tenant_access_token)\b\s*[:=]\s*(?!\[REDACTED\])["']?[^"'\s,}]+/gi,
    redact: "$1=[REDACTED]"
  },
  {
    name: "bearer_token",
    pattern: /\bbearer\s+(?!\[REDACTED\])[\w.-]{8,}/gi,
    redact: "Bearer [REDACTED]"
  },
  {
    name: "openai_key",
    pattern: /\bsk-[A-Za-z0-9]{12,}\b/g,
    redact: "[REDACTED]"
  },
  {
    name: "github_pat",
    pattern: /\bghp_[A-Za-z0-9]{20,}\b/g,
    redact: "[REDACTED]"
  },
  {
    name: "slack_token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g,
    redact: "[REDACTED]"
  },
  {
    name: "private_key",
    pattern: /-----BEGIN[\s\S]*?PRIVATE KEY-----[\s\S]*?-----END[\s\S]*?PRIVATE KEY-----/g,
    redact: "[REDACTED KEY]"
  }
];

export function redactSecrets(value) {
  let text = String(value ?? "");
  let redacted = false;
  for (const { pattern, redact } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    const next = text.replace(pattern, redact);
    if (next !== text) redacted = true;
    text = next;
  }
  return { text, redacted };
}

export function findUnredactedSecret(value) {
  const text = String(value ?? "");
  for (const { name, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return name;
  }
  return "";
}
