# 📚 Homework Tracker

A personal homework and study planner built as a web app. Organizes assignments by class, shows them on a calendar, and automatically figures out what you should work on first.

---

## What it does

- **Board view** — see all your homework grouped by class and day (A-Day / B-Day)
- **Calendar view** — monthly and weekly views showing what's due and what events you have
- **Plan view** — ranked priority list and daily schedule that tells you exactly what to do first and when
- **Smart priority score** — automatically scores every task based on how soon it's due, how hard it is, and how much study time you have left
- **Subtask checklists** — break big assignments into smaller steps
- **Events** — track clubs (Theater, ACE, Science Olympiad) and personal events alongside homework
- **Customize** — change the background, font, title, and icon to make it your own
- **Dark mode** — toggle between light and dark
- **Developer Mode** — log how long tasks actually took and see accuracy stats per class

---

## How to open it

This is a plain HTML app — no install needed.

1. Download or clone this repo
2. Open `index.html` in your browser (just double-click the file)
3. That's it — everything saves automatically in your browser

---

## Built with

- HTML, CSS, and JavaScript — no frameworks or libraries
- Google Fonts (Inter, Poppins, Merriweather, Space Mono)
- Browser `localStorage` to save your data

---

## Features worth knowing

- **Inline add** — click "No tasks yet" inside any class to add a task without opening a modal
- **Click a due date** on a card to change it right there
- **Priority algorithm** — combines urgency (days left vs. hours available) and weight (difficulty × class importance) into a 0–100 score
- **Daily schedule** — automatically fits tasks into your available study hours per day, accounting for club time
- All your data stays on your device — nothing is sent to a server

---

*Built for fun and learning.*
