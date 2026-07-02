# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public issue
2. Email the maintainers with details of the vulnerability
3. Include steps to reproduce if possible
4. Allow reasonable time for a fix before public disclosure

## Scope

This project runs locally and connects to local OpenClaw data. Security concerns include:

- **Local file access**: The dashboard reads from `~/.openclaw` and project repo paths
- **API routes**: All API routes are local-only (localhost:3333)
- **SQLite database**: Stored in `~/.openclaw-dashboard/data.db`
- **No authentication**: The dashboard assumes trusted local access

## Best Practices

- Never expose port 3333 to the public internet without authentication
- Keep `.env.local` out of version control
- Rotate API keys referenced in your OpenClaw configuration regularly
