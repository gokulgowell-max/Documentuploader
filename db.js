// db.js - Gowell Consultancy Database Seed, LocalStorage, and Google Sheets integration

const DEFAULT_TEAMS = [
  {
    id: "gulf-recruitment",
    name: "Gulf Recruitment Operations",
    icon: "fa-globe",
    description: "Recruitment operations for the GCC countries including UAE, Saudi Arabia, Qatar, Oman, and Kuwait. Specializing in hospitality, engineering, logistics, and retail."
  },
  {
    id: "euro-placement",
    name: "European Placement Division",
    icon: "fa-euro-sign",
    description: "Overseas employment opportunities in European countries including Germany, UK, Ireland, Poland, and Croatia. Focus areas include IT, skilled trades, and manufacturing."
  },
  {
    id: "healthcare-specialists",
    name: "Healthcare & Nursing Services",
    icon: "fa-user-md",
    description: "Dedicated healthcare recruitment for international hospitals. Placing qualified nurses, doctors, and lab technicians in prestigious health facilities."
  },
  {
    id: "academic-student-visa",
    name: "Study & Work Programs",
    icon: "fa-graduation-cap",
    description: "Assisting students and professionals in migrating via academic paths, combining study options with subsequent work permits in Canada, UK, and Europe."
  }
];

const DEFAULT_PROJECTS = [
  {
    id: "ksa-moh-nursing",
    teamId: "healthcare-specialists",
    title: "Saudi MOH Staff Nurses Recruitment",
    status: "ongoing",
    summary: "Large scale recruitment drive for B.Sc. and Post-Basic B.Sc. female nurses for Ministry of Health (MOH) Hospitals, Saudi Arabia.",
    details: `
      <h2>Saudi MOH Staff Nurses Recruitment Drive</h2>
      <p align="justify">Gowell International is organizing a direct client interview program for qualified B.Sc. Nurses on behalf of the Ministry of Health, Kingdom of Saudi Arabia. This is a premium opportunity for healthcare professionals to build an international career with excellent benefits.</p>
      
      <h3>Interview details & Schedule</h3>
      <p>Interviews will be conducted in Cochin and Bangalore. Expected dates are in the first week of next month. Selected candidates will receive direct deployment letters.</p>
      
      <h3>Criteria & Vacancies</h3>
      <table class="gowell-striped-table" style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <thead>
          <tr>
            <th>Department</th>
            <th>Required Experience</th>
            <th>Vacancies</th>
            <th>Basic Salary (SAR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>ICU / CCU</td>
            <td>2+ Years</td>
            <td>50</td>
            <td>4,500 - 5,500</td>
          </tr>
          <tr>
            <td>Emergency Room (ER)</td>
            <td>2+ Years</td>
            <td>40</td>
            <td>4,500 - 5,500</td>
          </tr>
          <tr>
            <td>Pediatric ICU</td>
            <td>3+ Years</td>
            <td>25</td>
            <td>4,800 - 5,800</td>
          </tr>
          <tr>
            <td>General Medical / Surgical</td>
            <td>2+ Years</td>
            <td>100</td>
            <td>4,000 - 4,800</td>
          </tr>
        </tbody>
      </table>
      
      <h3>Benefits Package</h3>
      <ul>
        <li>Free Family Status Accommodation or allowance</li>
        <li>Tax-free salary with annual increments</li>
        <li>30 days paid annual leave with free return tickets</li>
        <li>Free medical insurance and transport support</li>
      </ul>
    `,
    updatedAt: "2026-07-08T10:00:00Z"
  },
  {
    id: "germany-hospital-nursing",
    teamId: "healthcare-specialists",
    title: "German Fast-Track Nursing Program",
    status: "upcoming",
    summary: "Upcoming fast-track placement program for nurses in leading German hospitals. Offers German language training sponsorship.",
    details: `
      <h2>German Fast-Track Nursing Program (B1/B2 Sponsorship)</h2>
      <p align="justify">We are preparing to launch a collaborative recruitment campaign with German hospital networks for Indian nurses. This program offers full sponsorship for language training from A1 up to B2 levels, followed by direct placement in Germany.</p>
      
      <h3>Candidate Profile & Qualifications</h3>
      <p>Candidates must possess a GNM or B.Sc. in Nursing, a valid registration, and a strong interest in learning the German language.</p>
      
      <h3>Program Phases</h3>
      <table class="gowell-striped-table" style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <thead>
          <tr>
            <th>Phase</th>
            <th>Description</th>
            <th>Timeline</th>
            <th>Support Provided</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Phase 1: Language Training</td>
            <td>Complete A1-B1 levels in India</td>
            <td>6-8 Months</td>
            <td>100% Tuition Fee Cashback</td>
          </tr>
          <tr>
            <td>Phase 2: Job Matching</td>
            <td>Interviews with German Hospital representatives</td>
            <td>Month 6</td>
            <td>Visa processing assistance</td>
          </tr>
          <tr>
            <td>Phase 3: Recognition & Relocation</td>
            <td>B2 Language completion & Deficit Training in Germany</td>
            <td>3-4 Months</td>
            <td>Stipend during training in Germany</td>
          </tr>
        </tbody>
      </table>
      
      <h3>Important Requirements</h3>
      <ul>
        <li>No age limit, but strong motivation for learning German is mandatory.</li>
        <li>All candidate transcripts must be verified.</li>
      </ul>
    `,
    updatedAt: "2026-07-09T08:30:00Z"
  },
  {
    id: "uk-nhs-trust-placement",
    teamId: "healthcare-specialists",
    title: "UK NHS Trust Staff Nurses Placement",
    status: "completed",
    summary: "Successfully placed 75+ healthcare professionals in Midlands NHS Foundation Trust, UK.",
    details: `
      <h2>UK NHS Trust Nursing Program - Batch 4 Successful Placements</h2>
      <p>We are pleased to report that the recruitment process for Batch 4 Nurses under the Midlands NHS Trust has been successfully completed. 76 candidates have arrived in the UK and started their careers as Registered Nurses.</p>
      
      <h3>Deployment Statistics</h3>
      <table class="gowell-striped-table" style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <thead>
          <tr>
            <th>Specialty</th>
            <th>Nurses Placed</th>
            <th>CBT Status</th>
            <th>OSCE Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Critical Care</td>
            <td>18</td>
            <td>Cleared</td>
            <td>100% OSCE Pass on 1st Attempt</td>
          </tr>
          <tr>
            <td>Pediatric Ward</td>
            <td>12</td>
            <td>Cleared</td>
            <td>Pending 2 candidates</td>
          </tr>
          <tr>
            <td>Geriatric Wards</td>
            <td>26</td>
            <td>Cleared</td>
            <td>Cleared</td>
          </tr>
          <tr>
            <td>Theatre / Scrub</td>
            <td>20</td>
            <td>Cleared</td>
            <td>Cleared</td>
          </tr>
        </tbody>
      </table>
      
      <h3>Summary of Benefits Realized</h3>
      <ul>
        <li>Full refund of CBT and IELTS/OET exams</li>
        <li>Free flights and initial 3 months accommodation provided by the Trust</li>
        <li>OSCE preparation bootcamp sponsored</li>
      </ul>
    `,
    updatedAt: "2026-06-30T15:00:00Z"
  },
  {
    id: "uae-hospitality-crew",
    teamId: "gulf-recruitment",
    title: "Luxury Hotel Staff Recruitment - Dubai",
    status: "ongoing",
    summary: "Ongoing interview rounds for Waiters, Bartenders, Front Office Executives, and Chefs for a 5-star hotel group in Dubai.",
    details: `
      <h2>Dubai 5-Star Hotel Group Recruitment</h2>
      <p align="justify">Gowell is actively sourcing and interviewing candidates for pre-selection in hospitality roles. The final client interview will be conducted in Aluva in the mid of this month.</p>
      
      <h3>Positions, Vacancies and Remuneration</h3>
      <table class="gowell-striped-table" style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <thead>
          <tr>
            <th>Position</th>
            <th>Vacancies</th>
            <th>Basic Salary (AED)</th>
            <th>Key Requirements</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Front Desk Associate</td>
            <td>15</td>
            <td>2,800 - 3,500</td>
            <td>Excellent English communication, professional look</td>
          </tr>
          <tr>
            <td>Commis I / II (Chefs)</td>
            <td>20</td>
            <td>2,500 - 3,200</td>
            <td>Culinary degree or hotel experience</td>
          </tr>
          <tr>
            <td>Guest Service Waiters</td>
            <td>35</td>
            <td>1,800 - 2,200</td>
            <td>Good communication, hospitality background</td>
          </tr>
          <tr>
            <td>Housekeeping Executives</td>
            <td>30</td>
            <td>1,500 - 1,800</td>
            <td>Physical fitness, positive attitude</td>
          </tr>
        </tbody>
      </table>
      
      <h3>Standard Inclusions</h3>
      <ul>
        <li>Duty Meals provided by the hotel</li>
        <li>Free accommodation and sharing transportation</li>
        <li>Employment visa, air tickets, and medical benefits</li>
      </ul>
    `,
    updatedAt: "2026-07-09T09:00:00Z"
  },
  {
    id: "qatar-infra-engineers",
    teamId: "gulf-recruitment",
    title: "Civil & Infrastructure Engineers - Qatar",
    status: "upcoming",
    summary: "Upcoming vacancy for Civil Site Engineers, QA/QC Inspectors, and Surveyors for leading metro expansion works in Doha.",
    details: `
      <h2>Qatar Infrastructure Projects - Engineer Openings</h2>
      <p align="center"><strong>Upcoming Recruitment Campaign for Doha Metro Expansion Works</strong></p>
      <p align="justify">We have received requirements for specialized engineering personnel for Qatar's leading construction group. Pre-registration of profiles is open now.</p>
      
      <h3>Expected Openings</h3>
      <table class="gowell-striped-table" style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <thead>
          <tr>
            <th>Role</th>
            <th>Experience Required</th>
            <th>Target Vacancy</th>
            <th>UPDA License Requirement</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Site Civil Engineer</td>
            <td>5+ Years</td>
            <td>10</td>
            <td>Highly Preferred (Grade A/B)</td>
          </tr>
          <tr>
            <td>QA/QC Civil Engineer</td>
            <td>7+ Years</td>
            <td>5</td>
            <td>Mandatory</td>
          </tr>
          <tr>
            <td>Land Surveyor</td>
            <td>4+ Years</td>
            <td>12</td>
            <td>Not Mandatory (Diploma Holders)</td>
          </tr>
        </tbody>
      </table>
      
      <h3>Required Certifications & Documents</h3>
      <ul>
        <li>B.Tech/B.E in Civil Engineering (Attested by Ministry of External Affairs)</li>
        <li>Qatar UPDA registration details (if applicable)</li>
        <li>Detailed CV showing infrastructure project details</li>
      </ul>
    `,
    updatedAt: "2026-07-07T11:20:00Z"
  },
  {
    id: "ireland-it-devs",
    teamId: "euro-placement",
    title: "Software Engineers placement - Ireland",
    status: "ongoing",
    summary: "Direct hire program for Senior Frontend (React) and Backend (Java/Go) engineers in Dublin-based technology hubs.",
    details: `
      <h2>Ireland Tech Talents Relocation Campaign</h2>
      <p align="justify">Dublin's top-tier fintech and enterprise software companies are looking for talented senior developers from India. Gowell handles the initial vetting and technical interview scheduling.</p>
      
      <h3>Current Openings</h3>
      <table class="gowell-striped-table" style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <thead>
          <tr>
            <th>Role</th>
            <th>Skills Required</th>
            <th>Slots</th>
            <th>Salary Range (EUR/Year)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Senior Backend Developer</td>
            <td>Java 17, Spring Boot, AWS, Kubernetes</td>
            <td>8</td>
            <td>&euro; 75,000 - &euro; 90,000</td>
          </tr>
          <tr>
            <td>Frontend Architect</td>
            <td>React, TypeScript, Micro-frontends</td>
            <td>3</td>
            <td>&euro; 80,000 - &euro; 95,000</td>
          </tr>
          <tr>
            <td>DevOps Engineer</td>
            <td>Terraform, Docker, CI/CD, Azure</td>
            <td>5</td>
            <td>&euro; 70,000 - &euro; 85,000</td>
          </tr>
        </tbody>
      </table>
      
      <h3>Relocation & Sponsorship</h3>
      <ul>
        <li>Critical Skills Employment Permit (CSEP) sponsorship provided</li>
        <li>Relocation allowance up to &euro;5,000 for travel and initial stay</li>
        <li>Assistance with PPSN registration and flat search in Dublin</li>
      </ul>
    `,
    updatedAt: "2026-07-09T05:00:00Z"
  },
  {
    id: "poland-industrial-welders",
    teamId: "euro-placement",
    title: "MIG/TIG Welders & Fabricators - Poland",
    status: "completed",
    summary: "Completed visa processing and deployment of 40 industrial welders to shipyards in Gdansk, Poland.",
    details: `
      <h2>Poland Shipyard Welders - Project Completion Report</h2>
      <p align="justify">We are proud to announce the successful departure and onboarding of 40 structural MIG/TIG welders at our partner shipyards in Gdansk, Poland. This marks the third successful batch for Poland in 2026.</p>
      
      <h3>Project Milestones & Timelines</h3>
      <table class="gowell-striped-table" style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <thead>
          <tr>
            <th>Milestone</th>
            <th>Target Date</th>
            <th>Actual Completion</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Trade Skill Testing (Cochin)</td>
            <td>Jan 15, 2026</td>
            <td>Jan 14, 2026</td>
            <td>100% Pass Rate</td>
          </tr>
          <tr>
            <td>Work Permit Approvals (Poland)</td>
            <td>Apr 10, 2026</td>
            <td>Apr 08, 2026</td>
            <td>40 Permits Issued</td>
          </tr>
          <tr>
            <td>Visa Stamping & Booking</td>
            <td>Jun 15, 2026</td>
            <td>Jun 12, 2026</td>
            <td>All visas approved</td>
          </tr>
          <tr>
            <td>Onsite Deployment</td>
            <td>Jul 01, 2026</td>
            <td>Jul 02, 2026</td>
            <td>Reported on duty</td>
          </tr>
        </tbody>
      </table>
      
      <h3>Onsite Conditions</h3>
      <ul>
        <li>Hourly wage: 22-26 PLN net (after tax)</li>
        <li>Accommodation: Shared rooms (2 persons) near shipyard provided free of charge</li>
        <li>Opportunity to convert to long-term residency (Karta Pobytu)</li>
      </ul>
    `,
    updatedAt: "2026-07-03T14:00:00Z"
  }
];

// Initialize database storage configuration
function initializeDatabase() {
  if (!localStorage.getItem("gowell_teams")) {
    localStorage.setItem("gowell_teams", JSON.stringify(DEFAULT_TEAMS));
  }
  if (!localStorage.getItem("gowell_projects")) {
    localStorage.setItem("gowell_projects", JSON.stringify(DEFAULT_PROJECTS));
  }
  if (!localStorage.getItem("gowell_admin_pwd")) {
    localStorage.setItem("gowell_admin_pwd", "gowelladmin");
  }
  
  // Google Sheets Configurations
  if (!localStorage.getItem("gowell_sheet_id")) {
    // Setting default Google Sheet ID provided by the user
    localStorage.setItem("gowell_sheet_id", "1RGhBLpCS6oejCVITR_Qr_W20axelpDM-Z_c4yyFb4-8");
  }
  if (!localStorage.getItem("gowell_sheet_sync_enabled")) {
    localStorage.setItem("gowell_sheet_sync_enabled", "true"); // Sync by default
  }
  if (!localStorage.getItem("gowell_apps_script_url")) {
    localStorage.setItem("gowell_apps_script_url", ""); // For write operations
  }
}

// Database helper functions
const db = {
  init: initializeDatabase,
  
  getTeams: () => {
    initializeDatabase();
    return JSON.parse(localStorage.getItem("gowell_teams"));
  },
  
  saveTeams: (teams) => {
    localStorage.setItem("gowell_teams", JSON.stringify(teams));
  },
  
  getProjects: () => {
    initializeDatabase();
    return JSON.parse(localStorage.getItem("gowell_projects"));
  },
  
  saveProjects: (projects) => {
    localStorage.setItem("gowell_projects", JSON.stringify(projects));
  },
  
  getAdminPassword: () => {
    initializeDatabase();
    return localStorage.getItem("gowell_admin_pwd");
  },
  
  saveAdminPassword: (pwd) => {
    localStorage.setItem("gowell_admin_pwd", pwd);
  },

  // Sheet config getters/setters
  getSheetId: () => {
    initializeDatabase();
    return localStorage.getItem("gowell_sheet_id") || "";
  },

  saveSheetId: (id) => {
    localStorage.setItem("gowell_sheet_id", id.trim());
  },

  getAppsScriptUrl: () => {
    initializeDatabase();
    return localStorage.getItem("gowell_apps_script_url") || "";
  },

  saveAppsScriptUrl: (url) => {
    localStorage.setItem("gowell_apps_script_url", url.trim());
  },

  isSheetSyncEnabled: () => {
    initializeDatabase();
    return localStorage.getItem("gowell_sheet_sync_enabled") === "true";
  },

  setSheetSyncEnabled: (enabled) => {
    localStorage.setItem("gowell_sheet_sync_enabled", enabled ? "true" : "false");
  },
  
  // Full backup exports/imports
  exportData: () => {
    const data = {
      teams: db.getTeams(),
      projects: db.getProjects(),
      version: "1.1",
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  },
  
  importData: (jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      if (data.teams && Array.isArray(data.teams) && data.projects && Array.isArray(data.projects)) {
        db.saveTeams(data.teams);
        db.saveProjects(data.projects);
        return { success: true, message: "Database imported successfully!" };
      }
      return { success: false, message: "Invalid JSON database format." };
    } catch (e) {
      return { success: false, message: "Failed to parse JSON." };
    }
  },

  resetToDefault: () => {
    localStorage.setItem("gowell_teams", JSON.stringify(DEFAULT_TEAMS));
    localStorage.setItem("gowell_projects", JSON.stringify(DEFAULT_PROJECTS));
    localStorage.setItem("gowell_admin_pwd", "gowelladmin");
    localStorage.setItem("gowell_sheet_id", "1RGhBLpCS6oejCVITR_Qr_W20axelpDM-Z_c4yyFb4-8");
    localStorage.setItem("gowell_sheet_sync_enabled", "true");
    localStorage.setItem("gowell_apps_script_url", "");
    return { success: true, message: "Database reset to defaults!" };
  }
};
