/**

 * =========================================================

 *  DYNAMIC DOCUMENT HUB — SERVER-SIDE LOGIC (Code.gs)

 * =========================================================

 * Fixes applied vs. original version:

 *  1. doGet() had a syntax error ("{a") that broke the whole app.

 *  2. Manager access was a client-side-only prompt with the password

 *     visible in page source and bypassable via the browser console

 *     (any visitor could call google.script.run.managerDeleteProject

 *     etc. directly). All manager-only functions now require a

 *     passcode that is verified on the SERVER, stored only in

 *     PropertiesService (never shipped to the client).

 *  3. Editing a project's custom questions did not update the header

 *     row of its linked Google Sheet, so new submissions could land

 *     in the wrong columns. Headers are now kept in sync safely:

 *     existing columns/order are preserved (so historical data is

 *     never shifted), and any new question is appended at the end.

 *  4. submitUserData() now writes each answer by matching the

 *     sheet's actual header label rather than assuming a fixed

 *     column order — this guarantees "correct data in the correct

 *     column" even after a project's fields are changed later.

 *  5. Added input validation, filename sanitization, text-formatting

 *     for Passport/Mobile columns (prevents Sheets from mangling

 *     leading zeros / '+' signs), and defensive guards against

 *     empty-sheet edge cases that previously threw raw errors.

 * =========================================================

 */



var SHEET_CONFIG = 'Config';

var SHEET_PROJECTS = 'Project_Config';

var PROP_PASSCODE = 'MANAGER_PASSCODE';

var DEFAULT_PASSCODE = 'Gowell921'; // updated default passcode



var FIXED_HEADERS = ['Timestamp', 'Uploaded By', 'Candidate Name', 'Passport Number', 'Mobile Number'];

var DOC_URL_HEADER = 'Document URL';



// Team members who should automatically get Editor access on every newly

// created project Sheet + Drive folder. Add/remove emails here as needed.

var TEAM_EDITOR_EMAILS = ['gokul@gmail.com', 'kumar@gmail.com'];



// ------------------------------------------

// PERFORMANCE: short-lived server-side caching

// ------------------------------------------

// Opening external Sheets (SpreadsheetApp.openByUrl) is the slowest part of

// this app. Read-heavy endpoints cache their result for a few seconds so

// repeated loads (re-opening the dashboard, switching tabs back and forth)

// are instant, while any write (new submission, project edit, etc.)

// immediately invalidates the relevant cache key so data is never stale

// for more than a moment.

var CACHE_FORM_INIT_TTL = 30;   // recruiters/projects list for the public form

var CACHE_PROJECT_LIST_TTL = 15; // manager dashboard project cards + today counts

var CACHE_PERF_TTL = 15;         // performance monitor table per project



function cachePutSafe_(key, value, ttlSeconds) {

  try {

    CacheService.getScriptCache().put(key, value, ttlSeconds);

  } catch (e) {

    // Cache write failures (e.g. value too large) should never break the

    // actual feature — just skip caching for this call.

  }

}



function cacheRemoveSafe_(key) {

  try {

    CacheService.getScriptCache().remove(key);

  } catch (e) { /* ignore */ }

}



// ==========================================

// 1. APPLICATION ROUTING

// ==========================================



function doGet(e) {
  // ── External API call (GitHub Pages / static hosting) ──────────────────
  if (e && e.parameter && e.parameter.action) {
    try {
      var action = e.parameter.action;
      var args   = e.parameter.args ? JSON.parse(e.parameter.args) : [];
      var result = dispatchApiAction_(action, args);
      var json   = JSON.stringify({ success: true, data: result });

      // JSONP: wrap response in callback(…) — completely bypasses all CORS issues
      if (e.parameter.callback) {
        return ContentService
          .createTextOutput(e.parameter.callback + '(' + json + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(json)
        .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
      var errJson = JSON.stringify({ success: false, error: err.toString() });
      if (e.parameter.callback) {
        return ContentService
          .createTextOutput(e.parameter.callback + '(' + errJson + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(errJson)
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ── Normal Apps Script web app ──────────────────────────────────────────
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Dynamic Document Hub')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Routes an action name + args array to the correct server function.
 * Used by both doGet (GET API) and doPost (POST API / file uploads).
 */
function dispatchApiAction_(action, args) {
  if (action === 'getFormInitializationData')        return getFormInitializationData();
  if (action === 'getRecruiterSubmissionsHistory')   return getRecruiterSubmissionsHistory(args[0], args[1]);
  if (action === 'submitUserData')                   return submitUserData(args[0]);
  if (action === 'checkDuplicatePassport')           return checkDuplicatePassport(args[0], args[1]);
  if (action === 'checkManagerPasscode')             return checkManagerPasscode(args[0]);
  if (action === 'getExtendedProjectsList')          return getExtendedProjectsList(args[0], args[1]);
  if (action === 'getProjectDashboardMetrics')       return getProjectDashboardMetrics(args[0], args[1]);
  if (action === 'getRecruiterPerformanceForProject')return getRecruiterPerformanceForProject(args[0], args[1]);
  if (action === 'managerCreateRecruiter')           return managerCreateRecruiter(args[0], args[1]);
  if (action === 'managerDeleteProject')             return managerDeleteProject(args[0], args[1]);
  if (action === 'managerRepairProjectHeaders')      return managerRepairProjectHeaders(args[0], args[1]);
  if (action === 'managerChangePasscode')            return managerChangePasscode(args[0], args[1]);
  if (action === 'managerGrantTeamAccessToAllProjects') return managerGrantTeamAccessToAllProjects(args[0]);
  if (action === 'managerDeleteSubmissionRecord')    return managerDeleteSubmissionRecord(args[0], args[1], args[2], args[3], args[4]);
  if (action === 'managerSaveProjectConfig')         return managerSaveProjectConfig(args[0], args[1]);
  throw new Error('Unsupported API action: ' + action);
}



function include(filename) {

  return HtmlService.createHtmlOutputFromFile(filename).getContent();

}



// ==========================================

// 2. MANAGER AUTHENTICATION

// ==========================================



function getManagerPasscode_() {

  var props = PropertiesService.getScriptProperties();

  var pass = props.getProperty(PROP_PASSCODE);

  // First-time setup OR auto-migrate old default to new default
  if (!pass || pass === 'manager123') {

    pass = DEFAULT_PASSCODE;

    props.setProperty(PROP_PASSCODE, pass);

  }

  return pass;

}



function verifyManagerAccess_(passcode) {

  if (!passcode || passcode.toString() !== getManagerPasscode_()) {

    throw new Error('Access denied: invalid manager passcode.');

  }

}



// Called by the client the moment someone tries to open Manager Workspace.

function checkManagerPasscode(passcode) {

  verifyManagerAccess_(passcode);

  return true;

}



// Lets a manager rotate the passcode from inside the app instead of editing code.

function managerChangePasscode(oldPasscode, newPasscode) {

  verifyManagerAccess_(oldPasscode);

  var clean = (newPasscode || '').toString().trim();

  if (clean.length < 4) return 'Error: New passcode must be at least 4 characters.';

  PropertiesService.getScriptProperties().setProperty(PROP_PASSCODE, clean);

  return 'Passcode updated successfully. Use it next time you open Manager Workspace.';

}



/**
 * ONE-TIME SETUP FUNCTION — Run this manually from the Apps Script editor
 * (click ▶ Run button with this function selected) to force-set the passcode.
 * You only need to run this once. After that you can delete it if you want.
 */
function forceResetPasscode() {
  PropertiesService.getScriptProperties().setProperty(PROP_PASSCODE, 'Gowell921');
  Logger.log('Passcode has been set to: Gowell921');
}


// ==========================================

// 3. PUBLIC FORM INITIALIZATION (no auth — used by the upload form)

// ==========================================



function getFormInitializationData() {

  var cached = CacheService.getScriptCache().get('formInitData');

  if (cached) return JSON.parse(cached);



  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var configSheet = ss.getSheetByName(SHEET_CONFIG) || ss.insertSheet(SHEET_CONFIG);

  var projSheet = ss.getSheetByName(SHEET_PROJECTS) || ss.insertSheet(SHEET_PROJECTS);



  if (configSheet.getLastRow() === 0) configSheet.appendRow(['Recruiters List']);



  var recruiters = [];

  if (configSheet.getLastRow() >= 2) {

    recruiters = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 1).getValues().flat().filter(Boolean);

  }

  recruiters.sort(function(a, b) { return a.localeCompare(b); });



  var activeProjectsConfig = [];

  var projLastRow = projSheet.getLastRow();



  if (projLastRow >= 2) {

    var data = projSheet.getRange(2, 1, projLastRow - 1, 6).getValues();

    data.forEach(function(row) {

      var name = row[0];

      var submissionMode = row[3];

      var statusMode = row[4];

      var fields = row[5] ? JSON.parse(row[5]) : [];



      if (submissionMode === 'Active' && statusMode === 'Open') {

        activeProjectsConfig.push({ name: name, fields: fields });

      }

    });

  }

  activeProjectsConfig.sort(function(a, b) { return a.name.localeCompare(b.name); });



  var result = { recruiters: recruiters, projectsConfig: activeProjectsConfig };

  cachePutSafe_('formInitData', JSON.stringify(result), CACHE_FORM_INIT_TTL);

  return result;

}



function getProjectFieldsConfig(projectName) {

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var projSheet = ss.getSheetByName(SHEET_PROJECTS);

  if (!projSheet || projSheet.getLastRow() < 2) return [];



  var data = projSheet.getRange(2, 1, projSheet.getLastRow() - 1, 6).getValues();

  for (var i = 0; i < data.length; i++) {

    if (data[i][0] === projectName) {

      return data[i][5] ? JSON.parse(data[i][5]) : [];

    }

  }

  return [];

}



// ==========================================

// 4. MANAGER: PROJECT & RECRUITER CONFIGURATION (auth required)

// ==========================================



function getExtendedProjectsList(passcode, forceRefresh) {

  verifyManagerAccess_(passcode);



  var cacheKey = 'extendedProjectsList';

  if (!forceRefresh) {

    var cached = CacheService.getScriptCache().get(cacheKey);

    if (cached) return JSON.parse(cached);

  }



  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var projSheet = ss.getSheetByName(SHEET_PROJECTS) || ss.insertSheet(SHEET_PROJECTS);

  var lastRow = projSheet.getLastRow();

  if (lastRow < 2) return [];



  var data = projSheet.getRange(2, 1, lastRow - 1, 6).getValues();

  var list = data.map(function(row) {

    return {

      name: row[0],

      sheetUrl: row[1],

      folderUrl: row[2],

      submission: row[3],

      status: row[4],

      fields: row[5] ? JSON.parse(row[5]) : []

    };

  });



  var startOfToday = new Date();

  startOfToday.setHours(0, 0, 0, 0);

  var todayMs = startOfToday.getTime();



  // Only bother checking sheets for projects still marked "Open" — a

  // completed project can't receive new submissions, so skipping it

  // keeps the dashboard fast.

  list.forEach(function(p) {

    p.todaySubmissions = 0;

    p.dataUnreachable = false;

    if (p.status !== 'Open') return;



    try {

      var externalSs = SpreadsheetApp.openByUrl(p.sheetUrl);

      var sheet = externalSs.getSheets()[0];

      var sheetLastRow = sheet.getLastRow();

      if (sheetLastRow < 2) return;



      var timestamps = sheet.getRange(2, 1, sheetLastRow - 1, 1).getValues();

      timestamps.forEach(function(r) {

        var d = r[0] instanceof Date ? r[0] : new Date(r[0]);

        var check = new Date(d.getTime());

        check.setHours(0, 0, 0, 0);

        if (check.getTime() === todayMs) p.todaySubmissions++;

      });

    } catch (e) {

      p.dataUnreachable = true;

    }

  });



  list.sort(function(a, b) { return a.name.localeCompare(b.name); });

  cachePutSafe_(cacheKey, JSON.stringify(list), CACHE_PROJECT_LIST_TTL);

  return list;

}



/**

 * Builds the header row for a project's linked sheet WITHOUT ever

 * reordering or discarding existing columns. Any question already

 * present keeps its column position (so historical rows stay valid);

 * brand-new questions are appended just before "Document URL".

 */

function buildSyncedHeaders_(targetSheet, desiredFields) {

  var existingHeaders = [];

  if (targetSheet.getLastRow() >= 1 && targetSheet.getLastColumn() >= 1) {

    existingHeaders = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];

  }



  var existingCustomHeaders = [];

  if (existingHeaders.length > FIXED_HEADERS.length + 1) {

    existingCustomHeaders = existingHeaders.slice(FIXED_HEADERS.length, existingHeaders.length - 1);

  }



  var desiredLabels = (desiredFields || []).map(function(f) { return f.label; });

  var mergedCustomHeaders = existingCustomHeaders.slice();

  desiredLabels.forEach(function(label) {

    if (mergedCustomHeaders.indexOf(label) === -1) mergedCustomHeaders.push(label);

  });



  return FIXED_HEADERS.concat(mergedCustomHeaders, [DOC_URL_HEADER]);

}



// The recruiter-facing upload form has its own free-text "Remarks" note per

// submission (separate from a project's manager-only Remarks in

// Project_Config). It's treated as an always-present pseudo-field so it

// rides along with the same safe header-merge logic as custom questions:

// added once if missing, never duplicated, never reordered afterward.

var SUBMISSION_REMARKS_LABEL = 'Remarks';

function withSubmissionRemarksField_(fields) {

  return [{ id: '_submission_remarks', label: SUBMISSION_REMARKS_LABEL, type: 'text' }].concat(fields || []);

}



/**

 * Grants Editor access on a project's Sheet and Drive folder to every

 * email in TEAM_EDITOR_EMAILS. Safe to call repeatedly (addEditor is a

 * no-op if the person is already an editor). Returns an array of any

 * per-email/per-resource errors encountered (empty array = all good).

 */

function grantTeamEditors_(sheetUrl, folderUrl) {

  var errors = [];



  if (sheetUrl) {

    try {

      var ssObj = SpreadsheetApp.openByUrl(sheetUrl);

      TEAM_EDITOR_EMAILS.forEach(function(email) {

        try { ssObj.addEditor(email); } catch (e) { errors.push(email + ' (sheet): ' + e.toString()); }

      });

    } catch (e) {

      errors.push('Could not open sheet to grant access: ' + e.toString());

    }

  }



  if (folderUrl) {

    var folderIdMatch = folderUrl.match(/[-\w]{25,}/);

    if (folderIdMatch) {

      try {

        var folderObj = DriveApp.getFolderById(folderIdMatch[0]);

        TEAM_EDITOR_EMAILS.forEach(function(email) {

          try { folderObj.addEditor(email); } catch (e) { errors.push(email + ' (folder): ' + e.toString()); }

        });

      } catch (e) {

        errors.push('Could not open folder to grant access: ' + e.toString());

      }

    } else {

      errors.push('Could not parse folder ID from URL.');

    }

  }



  return errors;

}



/**

 * Retroactively grants TEAM_EDITOR_EMAILS access to every existing

 * project's Sheet + folder (for projects created before this feature

 * existed, or if TEAM_EDITOR_EMAILS was just changed).

 */

function managerGrantTeamAccessToAllProjects(passcode) {

  try {

    verifyManagerAccess_(passcode);



    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var projSheet = ss.getSheetByName(SHEET_PROJECTS);

    if (!projSheet || projSheet.getLastRow() < 2) return 'Error: No projects found.';



    var data = projSheet.getRange(2, 1, projSheet.getLastRow() - 1, 3).getValues();

    var successCount = 0;

    var allErrors = [];



    data.forEach(function(row) {

      var name = row[0], sheetUrl = row[1], folderUrl = row[2];

      var errs = grantTeamEditors_(sheetUrl, folderUrl);

      if (errs.length === 0) {

        successCount++;

      } else {

        allErrors.push(name + ': ' + errs.join('; '));

      }

    });



    var summary = 'Granted editor access on ' + successCount + ' of ' + data.length + ' project(s) to: ' + TEAM_EDITOR_EMAILS.join(', ') + '.';

    if (allErrors.length > 0) {

      summary += '\n\nIssues:\n' + allErrors.join('\n');

    }

    return summary;

  } catch (e) {

    Logger.log('managerGrantTeamAccessToAllProjects failed: %s', e.stack || e.toString());

    return 'Error: ' + e.toString();

  }

}



function managerSaveProjectConfig(payload, passcode) {

  try {

    verifyManagerAccess_(passcode);



    if (!payload || !payload.name || !payload.name.toString().trim()) {

      return 'Error: Project name is required.';

    }

    payload.name = payload.name.toString().trim();



    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var projSheet = ss.getSheetByName(SHEET_PROJECTS) || ss.insertSheet(SHEET_PROJECTS);



    if (projSheet.getLastRow() === 0) {

      projSheet.appendRow(['Project Name', 'Sheet URL', 'Folder URL', 'Submission Mode', 'Status Mode', 'Fields JSON']);

    }



    var lastRow = projSheet.getLastRow();

    var names = lastRow >= 2 ? projSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat() : [];

    var rowIndex = -1;



    var finalSheetUrl = payload.sheetUrl || '';

    var finalFolderUrl = payload.folderUrl || '';



    if (payload.originalName) {

      rowIndex = names.indexOf(payload.originalName);

      if (rowIndex === -1) return 'Error: Original project tracking profile not found.';

      rowIndex = rowIndex + 2;

    } else {

      if (names.indexOf(payload.name) !== -1) return 'Error: A project track with this identifier already exists.';



      var autoSpreadsheet = SpreadsheetApp.create('[Logs] ' + payload.name);

      var autoFolder = DriveApp.createFolder('[Files] ' + payload.name);



      finalSheetUrl = autoSpreadsheet.getUrl();

      finalFolderUrl = autoFolder.getUrl();



      // Automatically share the newly created Sheet + Drive folder with the team.

      grantTeamEditors_(finalSheetUrl, finalFolderUrl);

    }



    var externalSs = SpreadsheetApp.openByUrl(finalSheetUrl);

    var targetSheet = externalSs.getSheets()[0];



    var syncedHeaders = buildSyncedHeaders_(targetSheet, withSubmissionRemarksField_(payload.fields));

    targetSheet.getRange(1, 1, 1, syncedHeaders.length).setValues([syncedHeaders]);

    targetSheet.getRange(1, 1, 1, syncedHeaders.length).setFontWeight('bold');

    if (targetSheet.getFrozenRows() < 1) targetSheet.setFrozenRows(1);

    // Keep Passport Number & Mobile Number as plain text (avoids Sheets stripping

    // leading zeros or turning phone numbers into scientific notation).

    targetSheet.getRange(2, 4, Math.max(targetSheet.getMaxRows() - 1, 1), 2).setNumberFormat('@');



    var rowData = [

      payload.name,

      finalSheetUrl,

      finalFolderUrl,

      payload.submission,

      payload.status,

      JSON.stringify(payload.fields || [])

    ];



    if (rowIndex !== -1) {

      projSheet.getRange(rowIndex, 1, 1, 6).setValues([rowData]);

      cacheRemoveSafe_('formInitData');

      cacheRemoveSafe_('extendedProjectsList');

      cacheRemoveSafe_('perf_' + payload.name);

      return 'Project configuration changes updated successfully!';

    } else {

      projSheet.appendRow(rowData);

      cacheRemoveSafe_('formInitData');

      cacheRemoveSafe_('extendedProjectsList');

      return 'Project workspace generated automatically! Sheet & Drive Folder initialized.';

    }

  } catch (e) {

    return 'Ecosystem Initialization Exception Error: ' + e.toString();

  }

}



function managerDeleteProject(projectName, passcode) {

  try {

    verifyManagerAccess_(passcode);



    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var projSheet = ss.getSheetByName(SHEET_PROJECTS);

    if (!projSheet) return 'Error: Configuration repository missing.';



    var lastRow = projSheet.getLastRow();

    if (lastRow < 2) return 'Error: No operational projects found.';



    var data = projSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();

    var targetIndex = data.indexOf(projectName);



    if (targetIndex !== -1) {

      // Note: this removes the project from the tracking index only.

      // The underlying Google Sheet and Drive folder are left intact

      // so historical submissions are never destroyed accidentally.

      projSheet.deleteRow(targetIndex + 2);

      cacheRemoveSafe_('formInitData');

      cacheRemoveSafe_('extendedProjectsList');

      cacheRemoveSafe_('perf_' + projectName);

      return 'Success';

    }

    return 'Error: Project match could not be found.';

  } catch (e) {

    return 'Deletion Failure: ' + e.toString();

  }

}



function managerCreateRecruiter(recruiterName, passcode) {

  try {

    verifyManagerAccess_(passcode);



    if (!recruiterName || !recruiterName.toString().trim()) return 'Error: Recruiter name is required.';

    recruiterName = recruiterName.toString().trim();



    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var configSheet = ss.getSheetByName(SHEET_CONFIG) || ss.insertSheet(SHEET_CONFIG);

    if (configSheet.getLastRow() === 0) configSheet.appendRow(['Recruiters List']);



    var existing = configSheet.getLastRow() >= 2

      ? configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 1).getValues().flat()

      : [];

    if (existing.indexOf(recruiterName) !== -1) return 'Error: This recruiter already exists.';



    configSheet.appendRow([recruiterName]);

    cacheRemoveSafe_('formInitData');

    return 'Recruiter reference added.';

  } catch (e) {

    return 'Error: ' + e.toString();

  }

}



// ==========================================

// 5. MANAGER: ANALYTICS DASHBOARD (auth required)

// ==========================================



function getProjectDashboardMetrics(projectName, passcode) {

  try {

    verifyManagerAccess_(passcode);



    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var projSheet = ss.getSheetByName(SHEET_PROJECTS);

    if (!projSheet || projSheet.getLastRow() < 2) return { error: 'Project configuration sheet is empty.' };



    var sheetUrl = '';

    var folderUrl = '';



    var configData = projSheet.getRange(2, 1, projSheet.getLastRow() - 1, 3).getValues();

    for (var i = 0; i < configData.length; i++) {

      if (configData[i][0] === projectName) {

        sheetUrl = configData[i][1];

        folderUrl = configData[i][2];

        break;

      }

    }



    if (!sheetUrl) return { error: 'Spreadsheet URL connection string is empty.' };



    var externalSs = SpreadsheetApp.openByUrl(sheetUrl);

    var sheet = externalSs.getSheets()[0];

    var lastRow = sheet.getLastRow();



    var headers = lastRow > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];

    var rows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues() : [];



    var totalSubmissions = rows.length;
    var todaySubmissions = 0;
    var yesterdaySubmissions = 0;

    var recruiterTotalMap = {};
    var recruiterTodayMap = {};
    var recruiterYesterdayMap = {};

    var startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    var todayMs = startOfToday.getTime();
    var yesterdayMs = todayMs - 24 * 60 * 60 * 1000;

    var processedRows = [];

    rows.forEach(function(row) {
      // IMPORTANT: raw Date objects are converted to ISO strings before being
      // handed back to the client. Sending Date objects across the
      // google.script.run bridge is a known source of silent serialization
      // failures (the browser receives `null` instead of a clear error) —
      // this was the root cause of the "Null connection" dashboard bug.
      var rawTimestamp = row[0];
      var timestamp = rawTimestamp instanceof Date ? rawTimestamp : new Date(rawTimestamp);
      var recruiter = row[1] || 'Unknown';

      recruiterTotalMap[recruiter] = (recruiterTotalMap[recruiter] || 0) + 1;

      var checkDate = new Date(timestamp.getTime());
      checkDate.setHours(0, 0, 0, 0);
      var checkMs = checkDate.getTime();

      if (checkMs === todayMs) {
        todaySubmissions++;
        recruiterTodayMap[recruiter] = (recruiterTodayMap[recruiter] || 0) + 1;
      } else if (checkMs === yesterdayMs) {
        yesterdaySubmissions++;
        recruiterYesterdayMap[recruiter] = (recruiterYesterdayMap[recruiter] || 0) + 1;
      }

      var serializableCells = row.map(function(cell) {
        return cell instanceof Date ? cell.toISOString() : cell;
      });

      processedRows.push({
        timestamp: timestamp.toISOString(),
        recruiter: recruiter,
        candidateName: row[2],
        passport: row[3],
        mobile: row[4],
        allCells: serializableCells
      });
    });

    var recruiterBreakdown = Object.keys(recruiterTotalMap).map(function(rec) {
      return {
        name: rec,
        total: recruiterTotalMap[rec] || 0,
        today: recruiterTodayMap[rec] || 0,
        yesterday: recruiterYesterdayMap[rec] || 0
      };
    });
    recruiterBreakdown.sort(function(a, b) { return b.total - a.total; });

    return {
      projectName: projectName,
      sheetUrl: sheetUrl,
      folderUrl: folderUrl,
      headers: headers,
      total: totalSubmissions,
      today: todaySubmissions,
      yesterday: yesterdaySubmissions,
      recruiterData: recruiterBreakdown,
      allLogs: processedRows
    };

  } catch (e) {

    // Visible in Apps Script Editor → Executions, useful for diagnosing

    // access/permission issues that can't be fully described to the client.

    Logger.log('getProjectDashboardMetrics failed for "%s": %s', projectName, e.stack || e.toString());

    return { error: e.toString() };

  }

}



/**

 * Performance Monitor: for a given project, returns every known recruiter

 * (even ones with zero submissions, so nobody is missing from the table)

 * with their Today / Yesterday / Total CV counts for that project.

 */

function getRecruiterPerformanceForProject(projectName, passcode) {

  try {

    verifyManagerAccess_(passcode);



    var cacheKey = 'perf_' + projectName;

    var cached = CacheService.getScriptCache().get(cacheKey);

    if (cached) return JSON.parse(cached);



    var ss = SpreadsheetApp.getActiveSpreadsheet();



    var configSheet = ss.getSheetByName(SHEET_CONFIG);

    var allRecruiters = [];

    if (configSheet && configSheet.getLastRow() >= 2) {

      allRecruiters = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 1).getValues().flat().filter(Boolean);

    }



    var projSheet = ss.getSheetByName(SHEET_PROJECTS);

    if (!projSheet || projSheet.getLastRow() < 2) return { error: 'No projects found.' };



    var configData = projSheet.getRange(2, 1, projSheet.getLastRow() - 1, 2).getValues();

    var sheetUrl = null;

    for (var i = 0; i < configData.length; i++) {

      if (configData[i][0] === projectName) { sheetUrl = configData[i][1]; break; }

    }

    if (!sheetUrl) return { error: 'Project not found.' };



    var perf = {};

    allRecruiters.forEach(function(name) { perf[name] = { today: 0, yesterday: 0, total: 0 }; });



    var externalSs = SpreadsheetApp.openByUrl(sheetUrl);

    var sheet = externalSs.getSheets()[0];

    var lastRow = sheet.getLastRow();



    if (lastRow >= 2) {

      var startOfToday = new Date();

      startOfToday.setHours(0, 0, 0, 0);

      var todayMs = startOfToday.getTime();

      var yesterdayMs = todayMs - 24 * 60 * 60 * 1000;



      var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // Timestamp, Uploaded By

      rows.forEach(function(r) {

        var ts = r[0] instanceof Date ? r[0] : new Date(r[0]);

        var recruiter = r[1] || 'Unknown';

        if (!perf[recruiter]) perf[recruiter] = { today: 0, yesterday: 0, total: 0 };



        perf[recruiter].total++;



        var check = new Date(ts.getTime());

        check.setHours(0, 0, 0, 0);

        var checkMs = check.getTime();

        if (checkMs === todayMs) perf[recruiter].today++;

        else if (checkMs === yesterdayMs) perf[recruiter].yesterday++;

      });

    }



    var rowsOut = Object.keys(perf).map(function(name) {

      return { name: name, today: perf[name].today, yesterday: perf[name].yesterday, total: perf[name].total };

    });

    // Top performer first: sort by Today's count (descending), then Total

    // (descending) as a tiebreaker, then name for stability.

    rowsOut.sort(function(a, b) { return b.today - a.today || b.total - a.total || a.name.localeCompare(b.name); });



    var result = { projectName: projectName, rows: rowsOut };

    cachePutSafe_(cacheKey, JSON.stringify(result), CACHE_PERF_TTL);

    return result;

  } catch (e) {

    Logger.log('getRecruiterPerformanceForProject failed for "%s": %s', projectName, e.stack || e.toString());

    return { error: e.toString() };

  }

}



/**

 * Manually re-syncs a project's sheet header row against its current

 * field configuration, without touching any existing data rows.

 * Useful for repairing a project sheet whose headers drifted out of

 * sync (e.g. one edited before this header-sync fix was deployed).

 */

function managerRepairProjectHeaders(projectName, passcode) {

  try {

    verifyManagerAccess_(passcode);



    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var projSheet = ss.getSheetByName(SHEET_PROJECTS);

    if (!projSheet || projSheet.getLastRow() < 2) return 'Error: No project configurations available.';



    var lastRow = projSheet.getLastRow();

    var data = projSheet.getRange(2, 1, lastRow - 1, 6).getValues();

    var projectRow = null;

    for (var i = 0; i < data.length; i++) {

      if (data[i][0] === projectName) { projectRow = data[i]; break; }

    }

    if (!projectRow) return 'Error: Project profile not found.';



    var sheetUrl = projectRow[1];

    var fieldsConfig = JSON.parse(projectRow[5] || '[]');



    var externalSs = SpreadsheetApp.openByUrl(sheetUrl);

    var targetSheet = externalSs.getSheets()[0];



    var syncedHeaders = buildSyncedHeaders_(targetSheet, withSubmissionRemarksField_(fieldsConfig));

    targetSheet.getRange(1, 1, 1, syncedHeaders.length).setValues([syncedHeaders]);

    targetSheet.getRange(1, 1, 1, syncedHeaders.length).setFontWeight('bold');

    if (targetSheet.getFrozenRows() < 1) targetSheet.setFrozenRows(1);

    targetSheet.getRange(2, 4, Math.max(targetSheet.getMaxRows() - 1, 1), 2).setNumberFormat('@');



    return 'Headers repaired successfully. Current columns: ' + syncedHeaders.join(', ');

  } catch (e) {

    Logger.log('managerRepairProjectHeaders failed for "%s": %s', projectName, e.stack || e.toString());

    return 'Repair Failed: ' + e.toString();

  }

}



// ==========================================

// 6. PUBLIC: RECRUITER SUBMISSION ROUTINE (no auth — this is the public form action)

// ==========================================



function sanitizeFilename_(str) {

  return String(str || '').replace(/[\\/:*?"<>|]/g, '').trim();

}



function submitUserData(payload) {

  try {

    if (!payload || !payload.project || !payload.recruiter || !payload.candidateName || !payload.passportNumber) {

      return 'Error: Missing required submission fields.';

    }

    if (!/^[A-Za-z0-9]+$/.test(payload.passportNumber)) {

      return 'Error: Passport number may only contain letters and numbers.';

    }

    if (!payload.fileData || payload.fileData.indexOf('data:') !== 0) {

      return 'Error: No valid document was attached.';

    }



    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var projSheet = ss.getSheetByName(SHEET_PROJECTS);

    if (!projSheet || projSheet.getLastRow() < 2) return 'Error: No project configurations available.';



    var data = projSheet.getRange(2, 1, projSheet.getLastRow() - 1, 6).getValues();

    var projectRow = null;

    for (var i = 0; i < data.length; i++) {

      if (data[i][0] === payload.project) { projectRow = data[i]; break; }

    }



    if (!projectRow) return 'Error: Project profile not found.';

    if (projectRow[3] !== 'Active' || projectRow[4] !== 'Open') return 'Submissions closed for this project.';



    var sheetUrl = projectRow[1];

    var folderUrl = projectRow[2];

    var fieldsConfig = JSON.parse(projectRow[5] || '[]');



    var folderIdMatch = folderUrl.match(/[-\w]{25,}/);

    if (!folderIdMatch) return 'Error: Project folder link is invalid.';

    var folder = DriveApp.getFolderById(folderIdMatch[0]);



    var cleanCandidateName = sanitizeFilename_(payload.candidateName);

    var cleanPassport = sanitizeFilename_(payload.passportNumber);

    var timestampTag = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT', 'yyyyMMdd_HHmmss');

    var standardFileName = cleanCandidateName + ' ' + cleanPassport + ' [' + timestampTag + '].pdf';



    var contentMatch = payload.fileData.match(/data:(.*?);/);

    if (!contentMatch) return 'Error: Uploaded file data is invalid.';

    var contentType = contentMatch[1];

    var byteCharacters = Utilities.base64Decode(payload.fileData.split(',')[1]);

    var blob = Utilities.newBlob(byteCharacters, contentType, standardFileName);



    var file = folder.createFile(blob);

    var fileUrl = file.getUrl();



    var externalSs = SpreadsheetApp.openByUrl(sheetUrl);

    var targetSheet = externalSs.getSheets()[0];



    if (payload.overrideDuplicate) {

      try {

        var fileUrlToOverride = payload.overrideDuplicate.fileUrl;

        if (fileUrlToOverride) {

          var overrideFileIdMatch = fileUrlToOverride.match(/[-\w]{25,}/);

          if (overrideFileIdMatch) {

            var oldFile = DriveApp.getFileById(overrideFileIdMatch[0]);

            oldFile.setTrashed(true);

          }

        }

        targetSheet.deleteRow(payload.overrideDuplicate.rowIdx);

      } catch (delErr) {

        Logger.log('Failed to delete old duplicate record: ' + delErr.toString());

      }

    }



    // Write each answer into the column that actually matches its header label,

    // rather than assuming a fixed column order. This keeps data correctly

    // aligned even if the project's questions were changed after go-live.

    var lastCol = targetSheet.getLastColumn();

    var headers = lastCol > 0 ? targetSheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];

    if (headers.length === 0) {

      headers = buildSyncedHeaders_(targetSheet, withSubmissionRemarksField_(fieldsConfig));

      targetSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    }



    var answerByLabel = {};

    fieldsConfig.forEach(function(field) {

      answerByLabel[field.label] = (payload.dynamicAnswers && payload.dynamicAnswers[field.id]) || '';

    });

    // The recruiter's free-text note for this submission lands wherever the

    // "Remarks" column currently sits (added automatically if the sheet

    // predates this feature and hasn't been repaired/re-saved yet).

    answerByLabel[SUBMISSION_REMARKS_LABEL] = (payload.remarks || '').toString().trim().slice(0, 1000);



    var recordRow = headers.map(function(header, idx) {

      if (idx === 0) return new Date();

      if (idx === 1) return payload.recruiter;

      if (idx === 2) return cleanCandidateName;

      if (idx === 3) return cleanPassport;

      if (idx === 4) return payload.mobileNumber || '';

      if (idx === headers.length - 1 && header === DOC_URL_HEADER) return fileUrl;

      return answerByLabel.hasOwnProperty(header) ? answerByLabel[header] : '';

    });



    var newRowIndex = targetSheet.getLastRow() + 1;

    targetSheet.getRange(newRowIndex, 1, 1, recordRow.length).setValues([recordRow]);

    targetSheet.getRange(newRowIndex, 4, 1, 2).setNumberFormat('@'); // Passport & Mobile stay text



    cacheRemoveSafe_('extendedProjectsList');

    cacheRemoveSafe_('perf_' + payload.project);



    return 'Data record submitted successfully!';

  } catch (e) {

    Logger.log('submitUserData failed: %s', e.stack || e.toString());

    return 'Data processing failed: ' + e.toString();

  }

}

function getRecruiterSubmissionsHistory(projectName, recruiterName) {
  try {
    if (!projectName || !recruiterName) return [];
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var projSheet = ss.getSheetByName(SHEET_PROJECTS);
    if (!projSheet || projSheet.getLastRow() < 2) return [];
    var data = projSheet.getRange(2, 1, projSheet.getLastRow() - 1, 2).getValues();
    var sheetUrl = null;
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === projectName) { sheetUrl = data[i][1]; break; }
    }
    if (!sheetUrl) return [];
    var externalSs = SpreadsheetApp.openByUrl(sheetUrl);
    var sheet = externalSs.getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    var rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    var history = [];
    rows.forEach(function(row) {
      var ts = row[0];
      var uploadedBy = row[1];
      var name = row[2];
      var passport = row[3];
      if (uploadedBy && uploadedBy.toString().trim().toLowerCase() === recruiterName.toString().trim().toLowerCase()) {
        var dateStr = ts instanceof Date ? ts.toISOString() : new Date(ts).toISOString();
        history.push({
          timestamp: dateStr,
          candidateName: name,
          passportNumber: passport
        });
      }
    });
    history.sort(function(a, b) {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    return history;
  } catch (e) {
    Logger.log('getRecruiterSubmissionsHistory failed for "%s" / "%s": %s', projectName, recruiterName, e.stack || e.toString());
    return [];
  }
}

function checkDuplicatePassport(projectName, passportNumber) {
  try {
    if (!projectName || !passportNumber) return { isDuplicate: false };
    
    var cleanPassport = String(passportNumber).replace(/[\\/:*?"<>|]/g, '').trim().toLowerCase();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var projSheet = ss.getSheetByName(SHEET_PROJECTS);
    if (!projSheet || projSheet.getLastRow() < 2) return { isDuplicate: false };

    var data = projSheet.getRange(2, 1, projSheet.getLastRow() - 1, 2).getValues();
    var sheetUrl = null;
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === projectName) { sheetUrl = data[i][1]; break; }
    }
    if (!sheetUrl) return { isDuplicate: false };

    var externalSs = SpreadsheetApp.openByUrl(sheetUrl);
    var sheet = externalSs.getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { isDuplicate: false };

    var lastCol = sheet.getLastColumn();
    var allRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    
    for (var r = 0; r < allRows.length; r++) {
      var row = allRows[r];
      var rowPassport = String(row[3] || '').replace(/[\\/:*?"<>|]/g, '').trim().toLowerCase();
      if (rowPassport === cleanPassport) {
        return {
          isDuplicate: true,
          uploadedBy: String(row[1] || '').trim(),
          rowIdx: r + 2,
          fileUrl: String(row[lastCol - 1] || '')
        };
      }
    }
    
    return { isDuplicate: false };
  } catch(e) {
    Logger.log('checkDuplicatePassport error: ' + e.toString());
    return { isDuplicate: false };
  }
}

/**
 * Headless API router for static hosting environments (like GitHub Pages).
 * Enables cross-origin fetching to execute server-side Apps Script functions.
 */
function doPost(e) {
  try {
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var args = postData.args || [];
    var result;

    if (action === 'getFormInitializationData') {
      result = getFormInitializationData();
    } else if (action === 'getRecruiterSubmissionsHistory') {
      result = getRecruiterSubmissionsHistory(args[0], args[1]);
    } else if (action === 'checkDuplicatePassport') {
      result = checkDuplicatePassport(args[0], args[1]);
    } else if (action === 'submitUserData') {
      result = submitUserData(args[0]);
    } else if (action === 'checkManagerPasscode') {
      result = checkManagerPasscode(args[0]);
    } else if (action === 'getExtendedProjectsList') {
      result = getExtendedProjectsList(args[0], args[1]);
    } else if (action === 'getProjectDashboardMetrics') {
      result = getProjectDashboardMetrics(args[0], args[1]);
    } else if (action === 'getRecruiterPerformanceForProject') {
      result = getRecruiterPerformanceForProject(args[0], args[1]);
    } else if (action === 'managerCreateRecruiter') {
      result = managerCreateRecruiter(args[0], args[1]);
    } else if (action === 'managerDeleteProject') {
      result = managerDeleteProject(args[0], args[1]);
    } else if (action === 'managerRepairProjectHeaders') {
      result = managerRepairProjectHeaders(args[0], args[1]);
    } else if (action === 'managerChangePasscode') {
      result = managerChangePasscode(args[0], args[1]);
    } else if (action === 'managerGrantTeamAccessToAllProjects') {
      result = managerGrantTeamAccessToAllProjects(args[0]);
    } else if (action === 'managerDeleteSubmissionRecord') {
      result = managerDeleteSubmissionRecord(args[0], args[1], args[2], args[3], args[4]);
    } else {
      throw new Error('Unsupported API action: ' + action);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Removes a candidate's submission record from the project's Google Sheet
 * and moves their corresponding uploaded document file in Google Drive to the Trash.
 */
function managerDeleteSubmissionRecord(projectName, candidateName, passportNumber, fileUrl, passcode) {
  try {
    verifyManagerAccess_(passcode);
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var projSheet = ss.getSheetByName(SHEET_PROJECTS);
    if (!projSheet || projSheet.getLastRow() < 2) return 'Error: Project configuration sheet is empty.';
    
    var data = projSheet.getRange(2, 1, projSheet.getLastRow() - 1, 2).getValues();
    var sheetUrl = null;
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === projectName) { sheetUrl = data[i][1]; break; }
    }
    if (!sheetUrl) return 'Error: Project spreadsheet connection target not found.';
    
    var externalSs = SpreadsheetApp.openByUrl(sheetUrl);
    var sheet = externalSs.getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return 'Error: Project spreadsheet contains no submissions.';
    
    var rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    var targetRowIndex = -1;
    for (var j = 0; j < rows.length; j++) {
      var rowName = rows[j][2];
      var rowPassport = rows[j][3];
      if (rowName === candidateName && rowPassport === passportNumber) {
        targetRowIndex = j + 2; 
        break;
      }
    }
    
    if (targetRowIndex === -1) {
      return 'Error: Matching candidate submission record not found in spreadsheet.';
    }
    
    // 1. Move the uploaded document file in Google Drive to the Trash
    if (fileUrl) {
      var fileIdMatch = fileUrl.match(/[-\w]{25,}/);
      if (fileIdMatch) {
        try {
          var file = DriveApp.getFileById(fileIdMatch[0]);
          file.setTrashed(true);
        } catch (driveErr) {
          Logger.log('Drive file trash operation failed for ID "%s": %s', fileIdMatch[0], driveErr.toString());
        }
      }
    }
    
    // 2. Delete the row from the Google Sheet
    sheet.deleteRow(targetRowIndex);
    
    // Clear script cache records
    cacheRemoveSafe_('extendedProjectsList');
    cacheRemoveSafe_('perf_' + projectName);
    
    return 'Submission record cleared and Drive file moved to Trash!';
  } catch (e) {
    Logger.log('managerDeleteSubmissionRecord failed: %s', e.stack || e.toString());
    return 'Error deleting record: ' + e.toString();
  }
}