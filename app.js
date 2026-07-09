// app.js - Core application logic, Google Sheets Sync, visual editor, and router for Gowell InfoHub

// --- GLOBAL APPLICATION STATE ---
const state = {
  teams: [],
  projects: [],
  currentView: 'home', // 'home' | 'team' | 'admin'
  currentTeamId: null,
  activeFilterStatus: 'all', // 'all' | 'ongoing' | 'upcoming' | 'completed'
  searchQuery: '',
  adminActiveTab: 'projects', // 'projects' | 'teams' | 'settings'
  selectedProject: null,
  theme: 'light',
  isLoggedIn: false,
  
  // Modal states
  showTableDialog: false,
  
  // Forms state
  editingProjectId: null,
  editingTeamId: null
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  // Initialize storage & state
  db.init();
  state.teams = db.getTeams();
  state.projects = db.getProjects();
  
  // Theme check
  const savedTheme = localStorage.getItem('gowell_theme') || 'light';
  setTheme(savedTheme);
  
  // Check active admin session (simple session preservation)
  const sessionToken = sessionStorage.getItem('gowell_admin_token');
  if (sessionToken === 'authenticated') {
    state.isLoggedIn = true;
  }
  
  // Initialize routes from hash URL
  handleRouting();
  window.addEventListener('hashchange', handleRouting);
  
  // Bind Global UI Events
  bindGlobalEvents();

  // Trigger Google Sheet Auto Sync if enabled
  if (db.isSheetSyncEnabled() && db.getSheetId()) {
    triggerGoogleSheetsSync(true); // silent/on-load sync
  }
});

// --- THEME MANAGEMENT ---
function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('gowell_theme', theme);
  
  const themeBtnIcon = document.querySelector('.theme-toggle-btn i');
  if (themeBtnIcon) {
    themeBtnIcon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

// --- ROUTER / VIEW SWITCHER ---
function handleRouting() {
  const hash = window.location.hash;
  
  if (hash === '' || hash === '#home') {
    state.currentView = 'home';
    state.currentTeamId = null;
  } else if (hash.startsWith('#team/')) {
    state.currentView = 'team';
    state.currentTeamId = hash.split('/')[1];
    state.activeFilterStatus = 'all';
    state.searchQuery = '';
  } else if (hash === '#admin') {
    state.currentView = 'admin';
  } else {
    window.location.hash = '#home';
    return;
  }
  
  renderApp();
}

function navigateTo(hash) {
  window.location.hash = hash;
}

// --- RENDER APP ENGINE ---
function renderApp() {
  // Hide all main containers
  document.getElementById('home-view').style.display = 'none';
  document.getElementById('team-view').style.display = 'none';
  document.getElementById('admin-view').style.display = 'none';
  
  // Update header buttons active state
  const adminNavBtn = document.getElementById('nav-admin-btn');
  if (state.currentView === 'admin') {
    adminNavBtn.innerHTML = '<i class="fa-solid fa-house"></i> View Site';
    adminNavBtn.onclick = () => navigateTo('#home');
  } else {
    adminNavBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Admin Portal';
    adminNavBtn.onclick = () => navigateTo('#admin');
  }

  // Render view content
  if (state.currentView === 'home') {
    document.getElementById('home-view').style.display = 'block';
    renderHomeView();
  } else if (state.currentView === 'team') {
    document.getElementById('team-view').style.display = 'block';
    renderTeamView();
  } else if (state.currentView === 'admin') {
    document.getElementById('admin-view').style.display = 'block';
    renderAdminView();
  }
}

// --- HOME VIEW RENDERING ---
function renderHomeView() {
  // Refresh stats
  const totalTeams = state.teams.length;
  const totalProjects = state.projects.length;
  const ongoingCount = state.projects.filter(p => p.status === 'ongoing').length;
  const upcomingCount = state.projects.filter(p => p.status === 'upcoming').length;
  const completedCount = state.projects.filter(p => p.status === 'completed').length;
  
  // Render teams grid
  const grid = document.getElementById('teams-grid-container');
  grid.innerHTML = '';
  
  state.teams.forEach(team => {
    const teamProjects = state.projects.filter(p => p.teamId === team.id);
    const card = document.createElement('div');
    card.className = 'team-card';
    card.onclick = () => navigateTo(`#team/${team.id}`);
    
    card.innerHTML = `
      <div class="team-icon-wrapper">
        <i class="fa-solid ${team.icon || 'fa-users'}"></i>
      </div>
      <h3>${escapeHTML(team.name)}</h3>
      <p>${escapeHTML(team.description)}</p>
      <div class="team-card-footer">
        <span>${teamProjects.length} Projects</span>
        <i class="fa-solid fa-arrow-right"></i>
      </div>
    `;
    grid.appendChild(card);
  });
}

// --- TEAM VIEW RENDERING ---
function renderTeamView() {
  const team = state.teams.find(t => t.id === state.currentTeamId);
  if (!team) {
    navigateTo('#home');
    return;
  }
  
  // Team Header
  document.getElementById('team-view-title').innerHTML = `
    <i class="fa-solid ${team.icon || 'fa-users'}" style="color: var(--primary-color);"></i>
    ${escapeHTML(team.name)}
  `;
  document.getElementById('team-view-desc').innerText = team.description;
  
  // Refresh project lists
  const teamProjects = state.projects.filter(p => p.teamId === team.id);
  
  // Calculate tabs counts
  const counts = {
    all: teamProjects.length,
    ongoing: teamProjects.filter(p => p.status === 'ongoing').length,
    upcoming: teamProjects.filter(p => p.status === 'upcoming').length,
    completed: teamProjects.filter(p => p.status === 'completed').length
  };
  
  // Set tab badges
  document.getElementById('badge-all').innerText = counts.all;
  document.getElementById('badge-ongoing').innerText = counts.ongoing;
  document.getElementById('badge-upcoming').innerText = counts.upcoming;
  document.getElementById('badge-completed').innerText = counts.completed;
  
  // Filter & Search projects
  let filteredProjects = teamProjects;
  if (state.activeFilterStatus !== 'all') {
    filteredProjects = filteredProjects.filter(p => p.status === state.activeFilterStatus);
  }
  
  if (state.searchQuery.trim() !== '') {
    const query = state.searchQuery.toLowerCase();
    filteredProjects = filteredProjects.filter(p => 
      p.title.toLowerCase().includes(query) || 
      p.summary.toLowerCase().includes(query)
    );
  }
  
  // Render Project Cards
  const container = document.getElementById('projects-grid-container');
  container.innerHTML = '';
  
  if (filteredProjects.length === 0) {
    container.innerHTML = `
      <div class="no-projects">
        <i class="fa-solid fa-folder-open"></i>
        <p>No projects found in this category.</p>
      </div>
    `;
    return;
  }
  
  filteredProjects.forEach(proj => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.onclick = () => openProjectModal(proj.id);
    
    // Status text & icon (Static Ongoing)
    let statusLabel = 'Ongoing';
    let statusIcon = 'fa-circle-dot';
    if (proj.status === 'upcoming') {
      statusLabel = 'Upcoming';
      statusIcon = 'fa-calendar-days';
    } else if (proj.status === 'completed') {
      statusLabel = 'Completed';
      statusIcon = 'fa-circle-check';
    }
    
    const formattedDate = new Date(proj.updatedAt || Date.now()).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    
    card.innerHTML = `
      <div class="card-header">
        <span class="project-tag ${proj.status}">
          <i class="fa-solid ${statusIcon}"></i> ${statusLabel}
        </span>
      </div>
      <h4>${escapeHTML(proj.title)}</h4>
      <p class="project-summary">${escapeHTML(proj.summary)}</p>
      <div class="project-card-footer">
        <span>Updated: ${formattedDate}</span>
        <span class="click-hint">Read Details <i class="fa-solid fa-chevron-right"></i></span>
      </div>
    `;
    container.appendChild(card);
  });
}

// --- PROJECT DETAIL MODAL ---
function openProjectModal(projectId) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;
  
  const team = state.teams.find(t => t.id === project.teamId);
  state.selectedProject = project;
  
  // Fill Modal Contents
  document.getElementById('modal-project-title').innerText = project.title;
  document.getElementById('modal-project-team').innerHTML = `
    <i class="fa-solid fa-users"></i> ${escapeHTML(team ? team.name : 'Unknown Team')}
  `;
  
  // Status tag (Static Ongoing Icon)
  const statusBadge = document.getElementById('modal-project-status');
  statusBadge.className = `project-tag ${project.status}`;
  let statusText = 'Ongoing';
  let statusIcon = 'fa-circle-dot';
  if (project.status === 'upcoming') {
    statusText = 'Upcoming';
    statusIcon = 'fa-calendar-days';
  } else if (project.status === 'completed') {
    statusText = 'Completed';
    statusIcon = 'fa-circle-check';
  }
  statusBadge.innerHTML = `<i class="fa-solid ${statusIcon}"></i> ${statusText}`;
  
  // Detailed text body
  document.getElementById('modal-project-body').innerHTML = project.details || `<p>${escapeHTML(project.summary)}</p>`;
  
  // Show modal
  const modal = document.getElementById('project-detail-modal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeProjectModal() {
  const modal = document.getElementById('project-detail-modal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
  state.selectedProject = null;
}

// --- ADMIN PORTAL VIEW ---
function renderAdminView() {
  const loginSection = document.getElementById('admin-login-section');
  const dashSection = document.getElementById('admin-dashboard-section');
  
  if (!state.isLoggedIn) {
    loginSection.style.display = 'block';
    dashSection.style.display = 'none';
    document.getElementById('admin-login-pwd').value = '';
    document.getElementById('admin-login-pwd').focus();
    return;
  }
  
  loginSection.style.display = 'none';
  dashSection.style.display = 'block';
  
  // Set Active sidebar option
  document.querySelectorAll('.admin-menu-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.tab === state.adminActiveTab) {
      item.classList.add('active');
    }
  });
  
  // Hide all panels
  document.getElementById('admin-projects-panel').style.display = 'none';
  document.getElementById('admin-teams-panel').style.display = 'none';
  document.getElementById('admin-settings-panel').style.display = 'none';
  document.getElementById('admin-project-form-panel').style.display = 'none';
  document.getElementById('admin-team-form-panel').style.display = 'none';
  
  // Show active panel
  if (state.adminActiveTab === 'projects') {
    document.getElementById('admin-projects-panel').style.display = 'block';
    renderAdminProjectsList();
  } else if (state.adminActiveTab === 'teams') {
    document.getElementById('admin-teams-panel').style.display = 'block';
    renderAdminTeamsList();
  } else if (state.adminActiveTab === 'settings') {
    document.getElementById('admin-settings-panel').style.display = 'block';
    populateSettingsFields();
  }
}

// Admin project list render
function renderAdminProjectsList() {
  const tbody = document.querySelector('#admin-projects-table tbody');
  tbody.innerHTML = '';
  
  if (state.projects.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No projects in database. Click Add Project to start.</td></tr>';
    return;
  }
  
  state.projects.forEach(proj => {
    const team = state.teams.find(t => t.id === proj.teamId);
    const row = document.createElement('tr');
    
    let statusText = `<span class="project-tag ${proj.status}" style="font-size:0.75rem;">${proj.status}</span>`;
    const dateText = new Date(proj.updatedAt || Date.now()).toLocaleDateString('en-US');
    
    row.innerHTML = `
      <td style="font-weight:600;">${escapeHTML(proj.title)}</td>
      <td>${escapeHTML(team ? team.name : 'Deleted Team')}</td>
      <td>${statusText}</td>
      <td>${dateText}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon edit" onclick="showProjectForm('edit', '${proj.id}')" title="Edit Project"><i class="fa-solid fa-pencil"></i></button>
          <button class="btn-icon delete" onclick="deleteProject('${proj.id}')" title="Delete Project"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Admin team list render
function renderAdminTeamsList() {
  const tbody = document.querySelector('#admin-teams-table tbody');
  tbody.innerHTML = '';
  
  state.teams.forEach(team => {
    const teamProjects = state.projects.filter(p => p.teamId === team.id);
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td><span class="logo-icon" style="width:30px; height:30px; font-size:0.9rem;"><i class="fa-solid ${team.icon || 'fa-users'}"></i></span></td>
      <td style="font-weight:600;">${escapeHTML(team.name)}</td>
      <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(team.description)}</td>
      <td>${teamProjects.length}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon edit" onclick="showTeamForm('edit', '${team.id}')" title="Edit Team"><i class="fa-solid fa-pencil"></i></button>
          <button class="btn-icon delete" onclick="deleteTeam('${team.id}')" title="Delete Team"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// --- ADMIN LOGIN LOGIC ---
function handleAdminLogin(event) {
  event.preventDefault();
  const password = document.getElementById('admin-login-pwd').value;
  const correctPassword = db.getAdminPassword();
  
  if (password === correctPassword) {
    state.isLoggedIn = true;
    sessionStorage.setItem('gowell_admin_token', 'authenticated');
    renderAdminView();
  } else {
    alert('Invalid admin password! Please try again.');
  }
}

function handleAdminLogout() {
  if (confirm('Are you sure you want to log out from the Admin Portal?')) {
    state.isLoggedIn = false;
    sessionStorage.removeItem('gowell_admin_token');
    navigateTo('#home');
  }
}

// --- PROJECT CREATE/EDIT FORM LOGIC ---
function showProjectForm(mode, projectId = null) {
  state.adminActiveTab = '';
  document.querySelectorAll('.admin-menu-item').forEach(item => item.classList.remove('active'));
  
  document.getElementById('admin-projects-panel').style.display = 'none';
  document.getElementById('admin-project-form-panel').style.display = 'block';
  
  const formTitle = document.getElementById('project-form-title');
  const teamSelect = document.getElementById('project-form-team');
  
  teamSelect.innerHTML = '';
  state.teams.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.innerText = t.name;
    teamSelect.appendChild(opt);
  });
  
  const canvas = document.getElementById('editor-canvas');
  canvas.innerHTML = '<p><br></p>';
  
  if (mode === 'add') {
    state.editingProjectId = null;
    formTitle.innerText = 'Add New Project';
    document.getElementById('project-form-title-input').value = '';
    document.getElementById('project-form-status').value = 'ongoing';
    document.getElementById('project-form-summary').value = '';
  } else {
    state.editingProjectId = projectId;
    formTitle.innerText = 'Edit Project';
    
    const project = state.projects.find(p => p.id === projectId);
    if (project) {
      document.getElementById('project-form-title-input').value = project.title;
      document.getElementById('project-form-team').value = project.teamId;
      document.getElementById('project-form-status').value = project.status;
      document.getElementById('project-form-summary').value = project.summary;
      canvas.innerHTML = project.details || `<p>${escapeHTML(project.summary)}</p>`;
    }
  }
  
  initEditorState();
}

function hideProjectForm() {
  state.adminActiveTab = 'projects';
  renderAdminView();
}

function saveProject(event) {
  event.preventDefault();
  
  const title = document.getElementById('project-form-title-input').value.trim();
  const teamId = document.getElementById('project-form-team').value;
  const status = document.getElementById('project-form-status').value;
  const summary = document.getElementById('project-form-summary').value.trim();
  
  const canvas = document.getElementById('editor-canvas');
  let details = canvas.innerHTML;
  
  const rawHtmlTextarea = document.getElementById('editor-html-source');
  if (rawHtmlTextarea && rawHtmlTextarea.style.display !== 'none') {
    details = rawHtmlTextarea.value;
  }
  
  if (title === '' || summary === '') {
    alert('Please enter project title and brief summary!');
    return;
  }
  
  let targetProject;
  if (state.editingProjectId) {
    const idx = state.projects.findIndex(p => p.id === state.editingProjectId);
    if (idx !== -1) {
      state.projects[idx] = {
        ...state.projects[idx],
        title,
        teamId,
        status,
        summary,
        details,
        updatedAt: new Date().toISOString()
      };
      targetProject = state.projects[idx];
    }
  } else {
    const newId = 'proj-' + Date.now();
    targetProject = {
      id: newId,
      teamId,
      title,
      status,
      summary,
      details,
      updatedAt: new Date().toISOString()
    };
    state.projects.push(targetProject);
  }
  
  // Save database locally
  db.saveProjects(state.projects);
  
  // Write back to Google Sheets if Web App URL is configured
  if (db.getAppsScriptUrl()) {
    triggerGoogleSheetsPush();
  } else {
    alert('Project saved successfully to local workspace database! Note: Connect Google Apps Script URL in Settings to sync live to your Google Sheet.');
    hideProjectForm();
  }
}

function deleteProject(projectId) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;
  
  if (confirm(`Are you sure you want to delete the project "${project.title}"? This action cannot be undone.`)) {
    state.projects = state.projects.filter(p => p.id !== projectId);
    db.saveProjects(state.projects);
    
    if (db.getAppsScriptUrl()) {
      triggerGoogleSheetsPush();
    } else {
      alert('Project deleted successfully from local workspace database!');
      renderAdminProjectsList();
    }
  }
}

// --- TEAM CREATE/EDIT FORM LOGIC ---
function showTeamForm(mode, teamId = null) {
  state.adminActiveTab = '';
  document.querySelectorAll('.admin-menu-item').forEach(item => item.classList.remove('active'));
  
  document.getElementById('admin-teams-panel').style.display = 'none';
  document.getElementById('admin-team-form-panel').style.display = 'block';
  
  const formTitle = document.getElementById('team-form-title');
  
  if (mode === 'add') {
    state.editingTeamId = null;
    formTitle.innerText = 'Add New Team';
    document.getElementById('team-form-name-input').value = '';
    document.getElementById('team-form-icon-select').value = 'fa-globe';
    document.getElementById('team-form-desc').value = '';
  } else {
    state.editingTeamId = teamId;
    formTitle.innerText = 'Edit Team';
    
    const team = state.teams.find(t => t.id === teamId);
    if (team) {
      document.getElementById('team-form-name-input').value = team.name;
      document.getElementById('team-form-icon-select').value = team.icon || 'fa-globe';
      document.getElementById('team-form-desc').value = team.description;
    }
  }
}

function hideTeamForm() {
  state.adminActiveTab = 'teams';
  renderAdminView();
}

function saveTeam(event) {
  event.preventDefault();
  
  const name = document.getElementById('team-form-name-input').value.trim();
  const icon = document.getElementById('team-form-icon-select').value;
  const description = document.getElementById('team-form-desc').value.trim();
  
  if (name === '' || description === '') {
    alert('Please fill out all team fields!');
    return;
  }
  
  if (state.editingTeamId) {
    const idx = state.teams.findIndex(t => t.id === state.editingTeamId);
    if (idx !== -1) {
      state.teams[idx] = {
        ...state.teams[idx],
        name,
        icon,
        description
      };
    }
  } else {
    let newId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!newId) newId = 'team-' + Date.now();
    
    if (state.teams.some(t => t.id === newId)) {
      newId = newId + '-' + Date.now();
    }
    
    state.teams.push({
      id: newId,
      name,
      icon,
      description
    });
  }
  
  db.saveTeams(state.teams);
  
  if (db.getAppsScriptUrl()) {
    triggerGoogleSheetsPush();
  } else {
    alert('Division saved successfully to local workspace database!');
    hideTeamForm();
  }
}

function deleteTeam(teamId) {
  const team = state.teams.find(t => t.id === teamId);
  if (!team) return;
  
  const teamProjects = state.projects.filter(p => p.teamId === teamId);
  if (teamProjects.length > 0) {
    alert(`Cannot delete this team because it contains ${teamProjects.length} active project(s). You must first reassign or delete these projects.`);
    return;
  }
  
  if (confirm(`Are you sure you want to delete the team "${team.name}"?`)) {
    state.teams = state.teams.filter(t => t.id !== teamId);
    db.saveTeams(state.teams);
    
    if (db.getAppsScriptUrl()) {
      triggerGoogleSheetsPush();
    } else {
      alert('Division deleted successfully from local workspace database!');
      renderAdminTeamsList();
    }
  }
}

// --- SETTINGS CONTROLS & BINDINGS ---
function populateSettingsFields() {
  document.getElementById('settings-sheet-id').value = db.getSheetId();
  document.getElementById('settings-script-url').value = db.getAppsScriptUrl();
  document.getElementById('settings-auto-sync').checked = db.isSheetSyncEnabled();
  
  // Bind onchange settings auto saving
  document.getElementById('settings-sheet-id').onchange = (e) => db.saveSheetId(e.target.value);
  document.getElementById('settings-script-url').onchange = (e) => db.saveAppsScriptUrl(e.target.value);
  document.getElementById('settings-auto-sync').onchange = (e) => db.setSheetSyncEnabled(e.target.checked);
}

function changePassword(event) {
  event.preventDefault();
  const currentPwd = document.getElementById('pwd-current').value;
  const newPwd = document.getElementById('pwd-new').value;
  const confirmPwd = document.getElementById('pwd-confirm').value;
  const savedPwd = db.getAdminPassword();
  
  if (currentPwd !== savedPwd) {
    alert('Incorrect current password!');
    return;
  }
  if (newPwd.length < 5) {
    alert('New password must be at least 5 characters long.');
    return;
  }
  if (newPwd !== confirmPwd) {
    alert('Confirm password does not match new password!');
    return;
  }
  
  db.saveAdminPassword(newPwd);
  alert('Admin password updated successfully!');
  document.getElementById('pwd-current').value = '';
  document.getElementById('pwd-new').value = '';
  document.getElementById('pwd-confirm').value = '';
}

function exportDatabase() {
  const dataStr = db.exportData();
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  const exportFileDefaultName = `gowell_hub_backup_${new Date().toISOString().slice(0,10)}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}

function importDatabase(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const contents = e.target.result;
    const result = db.importData(contents);
    
    if (result.success) {
      state.teams = db.getTeams();
      state.projects = db.getProjects();
      alert(result.message);
      renderAdminView();
    } else {
      alert(result.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function resetToDefaultData() {
  if (confirm('Are you sure you want to reset all teams, projects, and connection settings? This will wipe Google Sheets config.')) {
    const result = db.resetToDefault();
    state.teams = db.getTeams();
    state.projects = db.getProjects();
    alert(result.message);
    renderAdminView();
  }
}

// --- GOOGLE SHEETS SYNC CONTROLLER ---

// UI loading triggers
function showSyncOverlay(title, msg) {
  document.getElementById('sync-title').innerText = title;
  document.getElementById('sync-message').innerText = msg;
  document.getElementById('sync-overlay').classList.add('active');
}

function hideSyncOverlay() {
  document.getElementById('sync-overlay').classList.remove('active');
}

// Public triggers for UI buttons
function syncFromGoogleSheetsBtn() {
  const sheetId = db.getSheetId();
  if (!sheetId) {
    alert('Please enter a valid Google Spreadsheet ID first!');
    return;
  }
  triggerGoogleSheetsSync(false);
}

function pushToGoogleSheetsBtn() {
  const scriptUrl = db.getAppsScriptUrl();
  if (!scriptUrl) {
    alert('You must provide a deployed Google Apps Script Web App URL in order to save/push database changes to Google Sheets! Please see the instruction guide below.');
    return;
  }
  triggerGoogleSheetsPush();
}

// Logic: Read Spreadsheet
async function triggerGoogleSheetsSync(isAutoOnLoad = false) {
  const sheetId = db.getSheetId();
  if (!sheetId) return;

  if (!isAutoOnLoad) {
    showSyncOverlay('Fetching Google Sheet...', 'Downloading teams and projects lists from spreadsheet.');
  }

  try {
    // We fetch sheets by exporting them as CSV. 
    // This works automatically for any Google Sheet shared as "Anyone with link can view" without requiring API tokens!
    const teamsUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=Teams`;
    const projectsUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=Projects`;

    const [teamsRes, projectsRes] = await Promise.all([
      fetch(teamsUrl).then(r => { if (!r.ok) throw new Error('Teams fetch error'); return r.text(); }),
      fetch(projectsUrl).then(r => { if (!r.ok) throw new Error('Projects fetch error'); return r.text(); })
    ]);

    // Parse CSV rows
    const teamsRows = parseCSV(teamsRes);
    const projectsRows = parseCSV(projectsRes);

    if (teamsRows.length <= 1 && projectsRows.length <= 1) {
      throw new Error('Google Sheet tabs are empty or columns are uninitialized.');
    }

    // Process Teams rows: [id, name, icon, description]
    const parsedTeams = [];
    if (teamsRows.length > 1) {
      const headers = teamsRows[0].map(h => h.trim().toLowerCase());
      const idIdx = headers.indexOf('id');
      const nameIdx = headers.indexOf('name');
      const iconIdx = headers.indexOf('icon');
      const descIdx = headers.indexOf('description');

      if (idIdx !== -1 && nameIdx !== -1) {
        for (let i = 1; i < teamsRows.length; i++) {
          const row = teamsRows[i];
          if (!row[idIdx]) continue;
          parsedTeams.push({
            id: row[idIdx].trim(),
            name: row[nameIdx] ? row[nameIdx].trim() : '',
            icon: iconIdx !== -1 && row[iconIdx] ? row[iconIdx].trim() : 'fa-globe',
            description: descIdx !== -1 && row[descIdx] ? row[descIdx].trim() : ''
          });
        }
      }
    }

    // Process Projects rows: [id, teamid, title, status, summary, details, updatedat]
    const parsedProjects = [];
    if (projectsRows.length > 1) {
      const headers = projectsRows[0].map(h => h.trim().toLowerCase());
      const idIdx = headers.indexOf('id');
      const teamIdIdx = headers.indexOf('teamid');
      const titleIdx = headers.indexOf('title');
      const statusIdx = headers.indexOf('status');
      const summaryIdx = headers.indexOf('summary');
      const detailsIdx = headers.indexOf('details');
      const dateIdx = headers.indexOf('updatedat');

      if (idIdx !== -1 && titleIdx !== -1) {
        for (let i = 1; i < projectsRows.length; i++) {
          const row = projectsRows[i];
          if (!row[idIdx]) continue;
          parsedProjects.push({
            id: row[idIdx].trim(),
            teamId: teamIdIdx !== -1 && row[teamIdIdx] ? row[teamIdIdx].trim() : '',
            title: row[titleIdx] ? row[titleIdx].trim() : '',
            status: statusIdx !== -1 && row[statusIdx] ? row[statusIdx].trim().toLowerCase() : 'ongoing',
            summary: summaryIdx !== -1 && row[summaryIdx] ? row[summaryIdx].trim() : '',
            details: detailsIdx !== -1 && row[detailsIdx] ? row[detailsIdx].trim() : '',
            updatedAt: dateIdx !== -1 && row[dateIdx] ? row[dateIdx].trim() : new Date().toISOString()
          });
        }
      }
    }

    // If both synced successfully and contain data, overwrite local database
    if (parsedTeams.length > 0) {
      state.teams = parsedTeams;
      db.saveTeams(parsedTeams);
    }
    if (parsedProjects.length > 0) {
      state.projects = parsedProjects;
      db.saveProjects(parsedProjects);
    }

    // Re-render
    renderApp();
    
    if (!isAutoOnLoad) {
      hideSyncOverlay();
      alert(`Synchronized with Google Sheets successfully!\nDownloaded: ${state.teams.length} Divisions and ${state.projects.length} Projects.`);
    }
  } catch (err) {
    console.error('Google Sheet synchronization failed:', err);
    if (!isAutoOnLoad) {
      hideSyncOverlay();
      alert('Google Sheets Sync Failed!\n\nCheck if:\n1. Your Spreadsheet ID is correct.\n2. The spreadsheet sharing is set to "Anyone with the link can view".\n3. The spreadsheet has tabs named exactly "Teams" and "Projects".\n\nFalling back to locally cached offline database.');
    }
  }
}

// Logic: Write back changes using Apps Script Web App
async function triggerGoogleSheetsPush() {
  const scriptUrl = db.getAppsScriptUrl();
  if (!scriptUrl) return;

  showSyncOverlay('Syncing Google Sheet...', 'Uploading and saving changes to your spreadsheet backend.');

  try {
    const payload = {
      action: 'pushAll',
      teams: state.teams,
      projects: state.projects
    };

    // Make POST request to the Apps Script Web App URL
    // We send payload as raw text and avoid pre-flight CORS precheck conflicts using plain postData
    const response = await fetch(scriptUrl, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Server response error');
    }

    const data = await response.json();
    hideSyncOverlay();
    
    if (data.success) {
      alert('Spreadsheet synchronized successfully! All changes are now live on your Google Sheet.');
      // Return to admin views
      if (state.currentView === 'admin') {
        if (state.editingProjectId || state.editingTeamId) {
          hideProjectForm();
          hideTeamForm();
        } else {
          renderAdminView();
        }
      }
    } else {
      alert('Apps Script reported error: ' + data.message);
    }
  } catch (err) {
    console.error('Failed to sync to Google Sheet:', err);
    hideSyncOverlay();
    alert('Failed to save to Google Sheet!\n\nVerify that:\n1. The Google Apps Script is deployed as a Web App.\n2. Access permission is set to "Anyone" (even anonymous).\n3. You copied the correct Web App Deployment URL.\n\nChanges have been saved locally in your browser cache, but are not live in the Google Sheet yet.');
  }
}

// Custom CSV Parser that handles double quotes, commas, and multiline values
function parseCSV(text) {
  const lines = [];
  let currentLine = [];
  let currentVal = '';
  let inQuotes = false;
  
  if (!text) return [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentLine.push(currentVal);
        currentVal = '';
      } else if (char === '\n' || char === '\r') {
        currentLine.push(currentVal);
        lines.push(currentLine);
        currentLine = [];
        currentVal = '';
        if (char === '\r' && nextChar === '\n') {
          i++; // skip LF
        }
      } else {
        currentVal += char;
      }
    }
  }
  
  // Capture residual values
  if (currentVal || currentLine.length > 0) {
    currentLine.push(currentVal);
    lines.push(currentLine);
  }
  
  return lines;
}

// --- WYSIWYG RICH TEXT EDITOR ENGINE ---
let sourceMode = false;

function initEditorState() {
  sourceMode = false;
  const canvas = document.getElementById('editor-canvas');
  const sourceTextarea = document.getElementById('editor-html-source');
  const sourceBtn = document.getElementById('editor-btn-source');
  
  canvas.style.display = 'block';
  sourceTextarea.style.display = 'none';
  sourceBtn.classList.remove('active');
  
  canvas.addEventListener('keyup', updateToolbarStates);
  canvas.addEventListener('mouseup', updateToolbarStates);
  
  canvas.focus();
}

function updateToolbarStates() {
  const formats = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'];
  formats.forEach(cmd => {
    const btn = document.getElementById(`editor-btn-${cmd}`);
    if (btn) {
      if (document.queryCommandState(cmd)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
}

function execEditorCommand(command, value = null) {
  if (sourceMode) return;
  
  document.execCommand(command, false, value);
  document.getElementById('editor-canvas').focus();
  updateToolbarStates();
}

function toggleSourceMode() {
  const canvas = document.getElementById('editor-canvas');
  const sourceTextarea = document.getElementById('editor-html-source');
  const sourceBtn = document.getElementById('editor-btn-source');
  
  sourceMode = !sourceMode;
  
  if (sourceMode) {
    sourceTextarea.value = canvas.innerHTML;
    canvas.style.display = 'none';
    sourceTextarea.style.display = 'block';
    sourceBtn.classList.add('active');
    
    document.querySelectorAll('.editor-toolbar button:not(#editor-btn-source)').forEach(btn => {
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
    });
    document.querySelectorAll('.editor-toolbar select').forEach(select => {
      select.disabled = true;
    });
  } else {
    canvas.innerHTML = sourceTextarea.value;
    sourceTextarea.style.display = 'none';
    canvas.style.display = 'block';
    sourceBtn.classList.remove('active');
    
    document.querySelectorAll('.editor-toolbar button:not(#editor-btn-source)').forEach(btn => {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    });
    document.querySelectorAll('.editor-toolbar select').forEach(select => {
      select.disabled = false;
    });
    canvas.focus();
  }
}

// Zebra table insertion function
function openTableCreator() {
  if (sourceMode) return;
  const dialog = document.getElementById('table-creator-dialog');
  dialog.classList.add('active');
  document.getElementById('table-rows').value = '3';
  document.getElementById('table-cols').value = '3';
  document.getElementById('table-rows').focus();
}

function closeTableCreator() {
  const dialog = document.getElementById('table-creator-dialog');
  dialog.classList.remove('active');
}

function confirmTableCreation() {
  const rows = parseInt(document.getElementById('table-rows').value) || 2;
  const cols = parseInt(document.getElementById('table-cols').value) || 2;
  
  closeTableCreator();
  insertZebraTable(rows, cols);
}

function insertZebraTable(rows, cols) {
  const canvas = document.getElementById('editor-canvas');
  canvas.focus();
  
  let tableHTML = '<table class="gowell-striped-table" style="width: 100%; border-collapse: collapse; margin: 15px 0;">';
  tableHTML += '<thead><tr>';
  for (let c = 1; c <= cols; c++) {
    tableHTML += `<th>Heading ${c}</th>`;
  }
  tableHTML += '</tr></thead>';
  tableHTML += '<tbody>';
  for (let r = 1; r <= rows; r++) {
    tableHTML += '<tr>';
    for (let c = 1; c <= cols; c++) {
      tableHTML += `<td>Cell Row ${r} - Col ${c}</td>`;
    }
    tableHTML += '</tr>';
  }
  tableHTML += '</tbody></table><p><br></p>';
  
  const selection = window.getSelection();
  if (selection.getRangeAt && selection.rangeCount) {
    const range = selection.getRangeAt(0);
    if (canvas.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      
      const el = document.createElement("div");
      el.innerHTML = tableHTML;
      const frag = document.createDocumentFragment();
      let node, lastNode;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      canvas.innerHTML += tableHTML;
    }
  } else {
    canvas.innerHTML += tableHTML;
  }
}

// --- GLOBAL BINDINGS ---
function bindGlobalEvents() {
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.onclick = () => {
      setTheme(state.theme === 'dark' ? 'light' : 'dark');
    };
  }
  
  const closeModalBtn = document.getElementById('close-modal-btn');
  if (closeModalBtn) {
    closeModalBtn.onclick = closeProjectModal;
  }
  
  const modalOverlay = document.getElementById('project-detail-modal');
  if (modalOverlay) {
    modalOverlay.onclick = (e) => {
      if (e.target === modalOverlay) closeProjectModal();
    };
  }
  
  const tableOverlay = document.getElementById('table-creator-dialog');
  if (tableOverlay) {
    tableOverlay.onclick = (e) => {
      if (e.target === tableOverlay) closeTableCreator();
    };
  }
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProjectModal();
      closeTableCreator();
    }
  });
}

function setupProjectFilters() {
  document.querySelectorAll('.status-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeFilterStatus = tab.dataset.status;
      renderTeamView();
    };
  });
  
  const searchInput = document.getElementById('project-search');
  if (searchInput) {
    searchInput.oninput = (e) => {
      state.searchQuery = e.target.value;
      renderTeamView();
    };
  }
}

function setAdminTab(tabName) {
  state.adminActiveTab = tabName;
  renderAdminView();
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
