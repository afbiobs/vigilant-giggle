/**
 * Gmail / Drive -> GitHub source-docx ingestion.
 *
 * Runs as a Google Apps Script in your own Google account. On a timer it looks
 * for new .docx attachments (in Gmail, and optionally in a shared Drive folder)
 * and commits them to source-docx/ in the repo. That push fires the existing
 * .github/workflows/process-docx.yml, which regenerates data/ and redeploys.
 *
 * Setup lives in README.md next to this file.
 */

// ---------------------------------------------------------------------------
// Config (read from Script Properties -- never hard-code the token here)
// ---------------------------------------------------------------------------

function getConfig_() {
  var props = PropertiesService.getScriptProperties();

  var cfg = {
    token: props.getProperty('GITHUB_TOKEN'),
    owner: props.getProperty('GITHUB_OWNER') || 'afbiobs',
    repo: props.getProperty('GITHUB_REPO') || 'vigilant-giggle',
    branch: props.getProperty('GITHUB_BRANCH') || 'main',
    targetDir: props.getProperty('TARGET_DIR') || 'source-docx',

    // Security control: only mail from these addresses is ever ingested.
    // Defaults to "only mail you sent yourself", i.e. you forward it in.
    allowedSenders: splitList_(props.getProperty('ALLOWED_SENDERS') || 'me'),

    // Gmail label applied once a message has been ingested (also the "done"
    // marker, so a message is never processed twice).
    processedLabel: props.getProperty('PROCESSED_LABEL') || 'docx-ingested',

    // How far back to look. Keeps the search cheap and stops the script from
    // rediscovering years of old mail if the label is ever removed.
    lookbackDays: parseInt(props.getProperty('LOOKBACK_DAYS') || '30', 10),

    // Optional: a Drive folder to watch as well. Blank disables Drive ingest.
    driveFolderId: (props.getProperty('DRIVE_FOLDER_ID') || '').trim(),

    // Optional: address to email a one-line summary to when something lands.
    notifyEmail: (props.getProperty('NOTIFY_EMAIL') || '').trim()
  };

  if (!cfg.token) {
    throw new Error('GITHUB_TOKEN script property is not set. See README.md.');
  }
  return cfg;
}

function splitList_(raw) {
  return raw.split(',').map(function (s) { return s.trim().toLowerCase(); })
            .filter(function (s) { return s.length > 0; });
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * Main entry point. Point a time-driven trigger at this (setup() does that).
 */
function ingest() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) {
    Logger.log('Another run is in progress; skipping.');
    return;
  }

  try {
    var cfg = getConfig_();
    var pushed = [];

    pushed = pushed.concat(processGmail_(cfg));
    if (cfg.driveFolderId) {
      pushed = pushed.concat(processDrive_(cfg));
    }

    if (pushed.length > 0) {
      Logger.log('Committed: ' + pushed.join(', '));
      notify_(cfg, pushed);
    } else {
      Logger.log('Nothing new to ingest.');
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Run this once by hand after pasting the script. It creates the Gmail label
 * and installs an hourly trigger, then does a first pass.
 */
function setup() {
  var cfg = getConfig_();

  if (!GmailApp.getUserLabelByName(cfg.processedLabel)) {
    GmailApp.createLabel(cfg.processedLabel);
    Logger.log('Created Gmail label: ' + cfg.processedLabel);
  }

  var existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'ingest';
  });
  if (existing.length === 0) {
    ScriptApp.newTrigger('ingest').timeBased().everyHours(1).create();
    Logger.log('Installed hourly trigger for ingest().');
  } else {
    Logger.log('Trigger already installed.');
  }

  ingest();
}

// ---------------------------------------------------------------------------
// Gmail
// ---------------------------------------------------------------------------

function processGmail_(cfg) {
  var query = buildQuery_(cfg);
  Logger.log('Gmail query: ' + query);

  var label = GmailApp.getUserLabelByName(cfg.processedLabel);
  if (!label) {
    label = GmailApp.createLabel(cfg.processedLabel);
  }

  var pushed = [];
  var threads = GmailApp.search(query, 0, 25);

  threads.forEach(function (thread) {
    var foundInThread = false;

    thread.getMessages().forEach(function (message) {
      if (!senderAllowed_(cfg, message)) {
        Logger.log('Skipping message from disallowed sender: ' + message.getFrom());
        return;
      }

      message.getAttachments({
        includeInlineImages: false,
        includeAttachments: true
      }).forEach(function (attachment) {
        if (!isDocx_(attachment.getName())) return;

        foundInThread = true;
        var name = safeName_(attachment.getName());
        var result = pushDocx_(cfg, name, attachment.getBytes(),
                               'via email: ' + message.getSubject());
        if (result.committed) pushed.push(name);
      });
    });

    // Label the thread either way, so a thread with no usable attachment is
    // not re-examined on every run.
    thread.addLabel(label);
    if (!foundInThread) {
      Logger.log('No .docx attachment in thread: ' + thread.getFirstMessageSubject());
    }
  });

  return pushed;
}

function buildQuery_(cfg) {
  var senders = cfg.allowedSenders.map(function (s) {
    return s === 'me' ? 'from:me' : 'from:' + s;
  }).join(' OR ');

  return '(' + senders + ')' +
         ' has:attachment filename:docx in:anywhere' +
         ' -label:' + cfg.processedLabel +
         ' newer_than:' + cfg.lookbackDays + 'd';
}

/**
 * Second check on top of the Gmail query, so a query typo can never widen the
 * set of people who can write to the repo.
 */
function senderAllowed_(cfg, message) {
  var from = (message.getFrom() || '').toLowerCase();
  var self = (Session.getActiveUser().getEmail() || '').toLowerCase();

  return cfg.allowedSenders.some(function (allowed) {
    if (allowed === 'me') return self !== '' && from.indexOf(self) !== -1;
    return from.indexOf(allowed) !== -1;
  });
}

// ---------------------------------------------------------------------------
// Drive (optional)
// ---------------------------------------------------------------------------

function processDrive_(cfg) {
  var folder = DriveApp.getFolderById(cfg.driveFolderId);
  var done = getOrCreateSubfolder_(folder, 'Processed');
  var pushed = [];

  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    if (!isDocx_(file.getName())) continue;

    var name = safeName_(file.getName());
    var result = pushDocx_(cfg, name, file.getBlob().getBytes(),
                           'via Drive folder');
    if (result.committed) pushed.push(name);

    // Move it out of the watched folder so it is not reconsidered next run.
    file.moveTo(done);
  }

  return pushed;
}

function getOrCreateSubfolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

/**
 * Create or update <targetDir>/<name> on the configured branch.
 * Returns {committed: bool, reason: string}.
 */
function pushDocx_(cfg, name, bytes, note) {
  var path = cfg.targetDir + '/' + name;
  var existing = getContentsMeta_(cfg, path);

  if (existing && existing.sha === gitBlobSha_(bytes)) {
    Logger.log('Unchanged, skipping: ' + path);
    return { committed: false, reason: 'identical' };
  }

  var payload = {
    message: (existing ? 'Update' : 'Add') + ' ' + path + ' (' + note + ')',
    content: Utilities.base64Encode(bytes),
    branch: cfg.branch
  };
  if (existing) payload.sha = existing.sha;

  var response = githubFetch_(cfg, contentsUrl_(cfg, path), {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });

  var code = response.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error('GitHub rejected ' + path + ' (HTTP ' + code + '): ' +
                    response.getContentText().slice(0, 500));
  }

  Logger.log((existing ? 'Updated ' : 'Added ') + path);
  return { committed: true, reason: existing ? 'updated' : 'created' };
}

function getContentsMeta_(cfg, path) {
  var response = githubFetch_(cfg, contentsUrl_(cfg, path) + '?ref=' +
                                   encodeURIComponent(cfg.branch),
                              { method: 'get' });

  var code = response.getResponseCode();
  if (code === 404) return null;
  if (code !== 200) {
    throw new Error('GitHub lookup failed for ' + path + ' (HTTP ' + code +
                    '): ' + response.getContentText().slice(0, 500));
  }
  return JSON.parse(response.getContentText());
}

function contentsUrl_(cfg, path) {
  var encoded = path.split('/').map(encodeURIComponent).join('/');
  return 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo +
         '/contents/' + encoded;
}

function githubFetch_(cfg, url, options) {
  options.headers = {
    Authorization: 'Bearer ' + cfg.token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  options.muteHttpExceptions = true;
  return UrlFetchApp.fetch(url, options);
}

/**
 * Git's own blob hash: sha1 over "blob <bytelength>" + NUL + content. Used to
 * tell "same file re-sent" from "genuinely revised file" without re-uploading.
 */
function gitBlobSha_(bytes) {
  var header = [];
  var prefix = 'blob ' + bytes.length;
  for (var i = 0; i < prefix.length; i++) {
    header.push(prefix.charCodeAt(i));
  }
  header.push(0);

  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1,
                                       header.concat(bytes));
  return digest.map(function (b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDocx_(name) {
  return /\.docx$/i.test(name || '');
}

/**
 * Filenames arrive from email, so treat them as untrusted: keep the basename
 * only, allow a conservative character set, and normalise the extension.
 */
function safeName_(name) {
  var base = String(name).split(/[\/\\]/).pop();
  base = base.replace(/\.docx$/i, '');

  // Word and mail clients love typographic characters; translate the common
  // ones rather than punching them out as underscores.
  base = base.replace(/[  -   　]/g, ' ')
             .replace(/[‐-―]/g, '-')
             .replace(/[‘’“”]/g, '');

  base = base.replace(/[^A-Za-z0-9 ._()-]/g, '_').replace(/\s+/g, ' ').trim();
  base = base.replace(/^[._]+/, '');
  if (!base) {
    base = 'upload-' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd-HHmmss');
  }
  return base + '.docx';
}

function notify_(cfg, pushed) {
  if (!cfg.notifyEmail) return;

  MailApp.sendEmail({
    to: cfg.notifyEmail,
    subject: 'Devotional source added: ' + pushed.length + ' file(s)',
    body: pushed.join('\n') + '\n\n' +
          'Processing runs automatically. Check the run here:\n' +
          'https://github.com/' + cfg.owner + '/' + cfg.repo + '/actions\n'
  });
}
