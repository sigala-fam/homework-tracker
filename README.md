# 📚 TaskNest — Homework Tracker

A homework and study planner that runs in your web browser. It organizes assignments by class, shows them on a calendar, and automatically figures out what you should work on first. Sign in and your homework is saved to your account, so it's there on any device.

**Try it:** https://homework-tracker-ashy.vercel.app

---

## What it does

- **Board view** — a big canvas you can move around, with your homework grouped into columns by class or day, plus sticky notes, pictures, tables and lines to connect things
- **Multiple boards** — make as many boards as you like and switch between them from the home screen
- **Calendar view** — monthly and weekly views showing what's due and what events you have
- **Plan view** — ranked priority list and daily schedule that tells you exactly what to do first and when
- **Smart priority score** — automatically scores every task based on how soon it's due, how hard it is, and how much study time you have left
- **Subtask checklists** — break big assignments into smaller steps
- **Events** — add your own clubs (with their own colors) and personal events alongside homework, including ones that repeat every week
- **Customize** — change the background and font to make it your own
- **Dark mode** — toggle between light and dark
- **Works on phones and tablets** — the layout rearranges to fit any screen, and the board works with touch (drag, pinch to zoom)
- **Developer Mode** — log how long tasks actually took and see accuracy stats per class
- **Entry page** — a friendly scrolling page that explains TaskNest before you sign in, with Midnight the pixel cat at the top
- **Loading skeleton** — soft gray placeholder shapes while TaskNest checks if you're signed in, so the screen never flashes the wrong page
- **Privacy Policy, Terms of Use, Cookies & Contact pages** — written in plain, friendly language, each with a "quick version" at the top
- **Safer sign-up** — 8+ character passwords with a weak / okay / strong meter, plus age and Terms checkboxes
- **Suggest a feature** — signed-in users can send ideas straight from the profile menu (anonymous unless they choose to include their email)
- **Matches your computer's theme** — light or dark automatically, until you pick one yourself
- **What's New page** — every update listed by version (1.0, 1.1 … 2.0), newest first, so people can see what changed. Open it from the 🎉 button in the profile menu or the link at the bottom of any page
- **Need help?** Email tasknesthelpdesk@gmail.com

---

## 🎉 What's New

TaskNest is on **version 2.4**. See the full update history on the [What's New page](https://homework-tracker-ashy.vercel.app/updates.html) (the file is `updates.html`).

Version numbers work like this:
- **Small update** → add .1 (2.3 → 2.4)
- **Big update** → next whole number (1.3 → 2.0)

To add an update, copy a version block in `updates.html`, put it at the top, bump the number, and update the "Latest" box.

---

## How to open it

**To use TaskNest:** go to https://homework-tracker-ashy.vercel.app and create a free account.

**To work on the code on your own computer:**

1. Download or clone this repo
2. In a terminal, go into the folder and start a little web server, for example `python3 -m http.server 3456`
3. Open http://localhost:3456 in your browser

(Double-clicking `index.html` won't work, because the app needs to be loaded from a web server to talk to Firebase.)

**Going live:** every push to the `main` branch on GitHub automatically updates the real website through Vercel.

---

## Built with

- HTML, CSS, and JavaScript — no frameworks
- **Firebase** — Authentication (email/password and Google sign-in), Firestore (the online database that saves your homework), and Storage (pictures you add to boards)
- **Vercel** — hosts the website
- Google Fonts (Inter, Poppins, Merriweather, Space Mono)
- Browser `localStorage` — only for small preferences on your device, like light/dark mode and your custom style

---

## Features worth knowing

- **Inline add** — click "No tasks yet" inside any class to add a task without opening a modal
- **Click a due date** on a card to change it right there
- **Priority algorithm** — combines urgency (days left vs. hours available) and weight (difficulty × class importance) into a 0–100 score
- **Daily schedule** — automatically fits tasks into your available study hours per day, accounting for club time
- **Your homework is private** — it's saved to your own account in Firebase, and the database rules only let *you* read or change it. See the [Privacy Policy](https://homework-tracker-ashy.vercel.app/privacy.html) for the details

---

*Built for fun and learning.*
