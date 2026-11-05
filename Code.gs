// Paste into Extensions > Apps Script of a NEW Google Sheet for store audits.
const SHARED_SECRET = "PASTE_SHARED_SECRET_HERE";   // must match TOKEN in index.html

const safe = v => (typeof v === "string" && /^[=+\-@]/.test(v)) ? "'" + v : v;

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== SHARED_SECRET) return out({ok:false, error:"bad token"});
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.keys(d.tabs).forEach(name => {
      const t = d.tabs[name];
      const sh = ss.getSheetByName(name) || ss.insertSheet(name);
      if (sh.getLastRow() === 0) { sh.appendRow(t.headers); sh.setFrozenRows(1); }
      // A resend of the same submission replaces its old rows instead of duplicating
      const last = sh.getLastRow();
      if (last > 1) {
        const ids = sh.getRange(2, 1, last - 1, 1).getValues().flat();
        for (let i = ids.length - 1; i >= 0; i--) if (ids[i] === d.submissionId) sh.deleteRow(i + 2);
      }
      if (t.rows.length) {
        const rows = t.rows.map(r => r.map(safe));
        sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      }
    });
    return out({ok:true});
  } catch (err) {
    return out({ok:false, error:String(err)});
  } finally {
    lock.releaseLock();
  }
}

function out(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
