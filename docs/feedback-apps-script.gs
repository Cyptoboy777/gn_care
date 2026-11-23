/*
  Receives ratings from GN Care and writes them to a Google Sheet. Free, no server needed.

  Setup:
  1. Create a Google Sheet (name it "GN Care feedback").
  2. In the sheet, open Extensions > Apps Script and paste this whole file.
  3. Change SECRET below to a long random text. Use the same text as FEEDBACK_SECRET in Vercel.
  4. Click Deploy > New deployment > type "Web app".
       Execute as: Me
       Who has access: Anyone
  5. Copy the Web app URL and put it in Vercel as FEEDBACK_WEBHOOK_URL. Redeploy.
*/
var SECRET = 'CHANGE-ME-TO-A-LONG-RANDOM-TEXT';
var SHEET_NAME = 'Feedback';

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return out({ ok: false });
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) sh.appendRow(['Time', 'Stars', 'Type', 'Message', 'Version']);
    sh.appendRow([new Date(d.ts || Date.now()), d.stars, d.kind, d.msg, d.v || '']);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
