# Two-Way Booth

A hands-free two-way interpreter for one phone on a table. The page listens, cuts speech at pauses, transcribes it with OpenAI and translates it with Claude.

## How access works

The provider keys live only in Netlify environment variables and are used by the functions in `netlify/functions`. Nobody using the page needs a key.

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Listening (speech to text) |
| `ANTHROPIC_API_KEY` | Translating. Use a key scoped to a workspace. |
| `INVITE_CODES` | Comma separated codes for family and friends |
| `ADMIN_CODES` | Comma separated codes with no daily limit |
| `DAILY_MINUTES` | Minutes of talk per phone per day for invite codes (default 10) |
| `GLOBAL_DAILY_MINUTES` | Safety cap for everyone together per day (default 120) |

Share `https://<site>/?code=<invite code>`. The page stores the code on that phone and removes it from the address bar.
