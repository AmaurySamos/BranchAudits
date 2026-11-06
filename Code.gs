// ===== STORE AUDIT: Google Sheets receiver =====
// Paste this whole file into Extensions > Apps Script of the Google Sheet, then Deploy as a Web app.
// Every submitted section arrives as {token, submissionId, tabs:{ "Tab name": {headers:[...], rows:[[...]]} }}
// and is written to the sheet tab with that name (the tab is created automatically).

const SHARED_SECRET = "PASTE_SHARED_SECRET_HERE"; // must be IDENTICAL to TOKEN in app.js

// Stops Excel/Sheets from treating text that starts with = + - @ as a formula
const safe = (v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v);

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // one submission at a time so rows never collide
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== SHARED_SECRET) return out({ ok: false, error: "bad token" });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.keys(d.tabs).forEach((name) => {
      const t = d.tabs[name];
      const sh = ss.getSheetByName(name) || ss.insertSheet(name);

      // First time this tab is used: write the header row
      if (sh.getLastRow() === 0) {
        sh.appendRow(t.headers);
        sh.setFrozenRows(1);
      }

      // Resubmitting a section replaces its old rows (column A = Submission ID) instead of duplicating them
      const last = sh.getLastRow();
      if (last > 1) {
        const ids = sh.getRange(2, 1, last - 1, 1).getValues().flat();
        for (let i = ids.length - 1; i >= 0; i--) {
          if (ids[i] === d.submissionId) sh.deleteRow(i + 2);
        }
      }

      // Add the new rows at the bottom
      if (t.rows.length) {
        const rows = t.rows.map((r) => r.map(safe));
        sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      }
    });
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Open the web app URL in a browser to confirm it is live
function doGet() {
  return out({ ok: true, message: "Store audit endpoint is live" });
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// RUN THIS ONCE from the Apps Script editor (select testWrite > Run) to authorize the script and test writing.
// It adds a "Test" tab to the sheet; delete that tab afterwards.
function testWrite() {
  const fake = {
    postData: {
      contents: JSON.stringify({
        token: SHARED_SECRET,
        submissionId: "TEST-1",
        tabs: { Test: { headers: ["Submission ID", "Note"], rows: [["TEST-1", "hello from testWrite"]] } },
      }),
    },
  };
  Logger.log(doPost(fake).getContent());
}
