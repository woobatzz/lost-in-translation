# Two-Way Booth

A hands-free two-way interpreter for one phone on a table.

**Live engine (default):** two GPT-Realtime-Translate streams run on the same microphone, one into each person's language. The model skips speech that is already in its target language, so each person only gets the other's words, translated while they talk.

**Classic engine (backup):** listens, cuts speech at pauses, transcribes with OpenAI and translates with Claude.

## How access works

The provider keys live only in Netlify environment variables and are used by the functions in `netlify/functions`. Nobody using the page needs a key.

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Live engine, and listening in Classic |
| `ANTHROPIC_API_KEY` | Translating in Classic. Use a key scoped to a workspace. |
| `INVITE_CODES` | Comma separated codes for family and friends |
| `ADMIN_CODES` | Comma separated codes with no daily limit |
| `DAILY_MINUTES` | Minutes per phone per day for invite codes (default 10). Live counts time with the mic on. |
| `GLOBAL_DAILY_MINUTES` | Safety cap for everyone together per day (default 120) |

Share `https://<site>/?code=<invite code>`. The page stores the code on that phone and removes it from the address bar.
