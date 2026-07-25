# Dynamic Document Hub — Recruiter CV Upload Portal

A premium recruiter document management system built for recruitment firms. Employees upload candidate CVs to active job projects. Managers monitor submissions, manage projects, and track team performance — all connected to Google Sheets & Google Drive as the backend.

## Live Demo
> After deploying, your site will be available at:  
> `https://<your-github-username>.github.io/<your-repo-name>/`

---

## Features

### Recruiter (Employee) Side
- Select your name and an active job project
- Fill in candidate identity details (name, passport, phone, DOB, nationality)
- Answer custom project-specific questions
- Upload the candidate's CV/PDF document
- View your previously submitted candidates per project

### Manager Side (Password Protected)
- Create, edit and delete job projects
- Add custom form fields per project (text, number, date, dropdown)
- View all submissions with date-range filtering
- Delete individual submission records (removes from Sheet + Drive)
- View team performance leaderboard
- **⚙️ Connection** button to link site to your Google Apps Script backend

---

## Setup Instructions

### Step 1 — Deploy Google Apps Script Backend

1. Open your Google Apps Script project at [script.google.com](https://script.google.com)
2. Paste the contents of `Code.gs` into your script editor
3. Click **Deploy → New Deployment**
4. Select type: **Web App**
5. Set **Execute as**: Me  
   Set **Who has access**: Anyone
6. Click **Deploy** and copy the **Web App URL**

> The URL looks like: `https://script.google.com/macros/s/AKfycb.../exec`

### Step 2 — Deploy to GitHub Pages

1. Create a new repository on [github.com](https://github.com)
2. Upload all files from the `github-pages/` folder to the repository root
3. Go to **Settings → Pages**
4. Under **Source**, select **Deploy from a branch**
5. Choose **main** branch and **/ (root)** folder
6. Click **Save** — your site goes live in ~60 seconds

### Step 3 — Connect to Your Backend

1. Open your live GitHub Pages site
2. Click **🔒 Manager Workspace** and enter your manager passcode
3. In the Manager Dashboard, click the **⚙️ Connection** button
4. Paste your Google Apps Script Web App URL and click **Connect Backend**
5. The page reloads and is now fully connected to your Google Sheets and Drive

---

## File Structure

```
github-pages/
├── index.html        ← Single-file web app (upload this to GitHub)
└── README.md         ← This file

Source files (for editing):
├── Index.html        ← Main layout, theme, routing logic
├── UserForm.html     ← Recruiter upload form
├── AdminPanel.html   ← Manager dashboard
└── Code.gs           ← Google Apps Script backend
```

---

## Technology

- **Frontend**: Vanilla HTML, CSS, JavaScript — no build tools required
- **Styling**: Tailwind CSS v2 (CDN) + custom premium design system
- **Backend**: Google Apps Script (Web App)
- **Storage**: Google Sheets (data) + Google Drive (files)
- **Hosting**: GitHub Pages (free static hosting)

---

## Manager Passcode

The default passcode is set in your Google Apps Script via `PropertiesService`.  
To change it: **Manager Workspace → 🔑 Passcode**

---

*Built with the Dynamic Document Hub system.*
