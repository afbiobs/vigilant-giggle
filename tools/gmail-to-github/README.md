# Add a DOCX by email (or Drive) — no browser, no GitHub login

The repo already turns `source-docx/*.docx` into `data/` automatically: any push
that touches that folder fires
[`.github/workflows/process-docx.yml`](../../.github/workflows/process-docx.yml),
which runs `prepare_thoughts_v2.py` and commits the regenerated JSON.

The only manual step left is *getting the file into `source-docx/`*. This tool
removes that step. Once it is set up:

> **Forward the email to yourself. Done.**
> Within the hour the file is committed, the workflow runs, and the site updates.

An optional Drive folder works the same way — drop a `.docx` in, and it is picked
up on the next run.

## How it works

```
you forward the email  ->  Apps Script (in your Google account, hourly)
                             |  finds .docx attachments from allowed senders
                             v
                           GitHub Contents API  ->  commit to source-docx/
                             |
                             v
                           process-docx.yml  ->  regenerates data/  ->  site updates
```

No server, no webhook endpoint, no third-party service. The script runs inside
your own Google account on Google's free Apps Script tier.

## Security model

Three independent limits, so a stray email can never write to the repo:

1. **Sender allowlist.** `ALLOWED_SENDERS` defaults to `me` — only mail *you
   sent* is considered, which is exactly what forwarding produces. Anyone
   emailing you a `.docx` is ignored. The allowlist is enforced twice: in the
   Gmail search query and again per-message before upload.
2. **A repo-scoped token.** The fine-grained PAT below can write to this one
   repository and nothing else in your account.
3. **Filename sanitising.** Attachment names come from outside, so the script
   keeps the basename only, restricts it to a safe character set, and forces the
   `.docx` extension — a crafted name cannot escape `source-docx/`.

Identical re-sends are detected by Git blob hash and skipped, so forwarding the
same email twice is harmless. A revised file with the same name updates the
existing one, which is what you want — the workflow reprocesses it.

## Setup (about 10 minutes, once)

### 1. Create the GitHub token

GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained
tokens → Generate new token**:

- **Repository access:** Only select repositories → `afbiobs/vigilant-giggle`
- **Permissions:** Repository permissions → **Contents: Read and write**
- **Expiration:** your call — set a calendar reminder, since ingestion silently
  stops working when it expires (you will see failure emails from Apps Script).

Copy the token.

### 2. Create the Apps Script project

Go to <https://script.google.com> → **New project**. Name it something like
`Devotional DOCX ingest`.

Paste the contents of [`Code.gs`](./Code.gs) over the default `Code.gs`.

Optionally, to match the scopes exactly: **Project Settings** → tick *Show
`appsscript.json` manifest file in editor*, then paste in
[`appsscript.json`](./appsscript.json). (If you are not using the Drive inlet,
you can delete the `.../auth/drive` scope and the `processDrive_` /
`getOrCreateSubfolder_` functions.)

### 3. Add the settings

**Project Settings → Script Properties → Add script property**:

| Property | Value | Required |
| --- | --- | --- |
| `GITHUB_TOKEN` | the token from step 1 | yes |
| `GITHUB_OWNER` | `afbiobs` | no (default) |
| `GITHUB_REPO` | `vigilant-giggle` | no (default) |
| `GITHUB_BRANCH` | `main` | no (default) |
| `ALLOWED_SENDERS` | `me` — or a comma-separated list of addresses | no (default) |
| `PROCESSED_LABEL` | Gmail label used as the "done" marker | no (default `docx-ingested`) |
| `LOOKBACK_DAYS` | how far back to search | no (default `30`) |
| `DRIVE_FOLDER_ID` | Drive folder to watch — blank disables | no |
| `NOTIFY_EMAIL` | address to email a summary to when files land | no |

Only `GITHUB_TOKEN` is strictly required.

### 4. Run `setup()` once

In the editor, pick the `setup` function and press **Run**. Google asks you to
authorise the script — this is your own script, so the "unverified app" warning
is expected: **Advanced → Go to (project name)**.

`setup()` creates the Gmail label, installs the hourly trigger, and does a first
pass immediately.

### 5. Test it

Forward yourself an email with a `.docx` attached, then press **Run** on
`ingest` rather than waiting for the hour. Check:

- the **Execution log** in Apps Script,
- the new commit in `source-docx/`,
- the workflow run under the repo's **Actions** tab.

## Skipping the forward

If the documents always arrive from the same address, you can drop the manual
forward entirely:

1. Set `ALLOWED_SENDERS` to that address (e.g. `author@example.com`).
2. Nothing else changes — the script picks their mail up directly.

Only do this for a sender you trust to write to the repository, since it means
their attachments are committed without you seeing them first.

## Using the Drive folder instead

Set `DRIVE_FOLDER_ID` to the folder's ID — the long string in its URL:
`https://drive.google.com/drive/folders/`**`1AbC...xyz`**.

Drop a `.docx` in (from phone, desktop, or Gmail's "Save to Drive" on an
attachment) and it is committed on the next run, then moved into a `Processed`
subfolder inside the same folder so you can see what has been handled.

Note: a native **Google Doc** is not a `.docx` and is skipped. Use *File →
Download → Microsoft Word (.docx)* first, or send it by email instead.

## If something goes wrong

- **Nothing happens.** Run `ingest` by hand and read the Execution log. The most
  common causes are a missing/expired `GITHUB_TOKEN` and the thread already
  carrying the `docx-ingested` label — remove the label to re-run a message.
- **The commit lands but the site does not update.** That is the workflow, not
  this script. Open the repo's **Actions** tab; a parsing failure in
  `prepare_thoughts_v2.py` shows there, and GitHub emails you about failed runs.
- **`HTTP 403` / `404` from GitHub.** The token lacks **Contents: Read and
  write**, or was not granted access to this repository.
- **Apps Script emails you about a failed execution.** That is the intended
  alarm — the run threw, and the message names the file it choked on.
