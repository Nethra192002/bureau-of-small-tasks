# Bureau of Small Tasks

A to-do app that looks like a desk. Tasks show up as paperwork and you stamp them DONE, DELAYED or DENIED.

![Demo](docs/demo.gif)

## How to use it

1. Type a task in the slot at the bottom and press Enter. It goes to the In-tray.
2. Click the In-tray to put a paper on the desk (up to five at a time).
3. Click a paper, then press **D** (done), **L** (delayed) or **X** (denied). You can also drag a stamp onto it.
4. At the end of the day, ring the bell. You get a shift report, and unfinished papers come back tomorrow morning.

Add a date to schedule a task: `standup Mon 10am`, `dentist 14 Dec 3pm`. It shows up on that day.

## What's on the desk

| Object | What it does |
|---|---|
| In-tray | Papers waiting. Click to take one. |
| Out-tray | Papers done today. Click to see everything you've stamped and reopen any of it. |
| Later clipboard | Delayed papers. Click to bring one back. |
| Bin | Drag a paper here to delete it. You get 5 seconds to undo. |
| Shredder | Where denied papers go. |
| Calendar | Today's date and your streak. Click for the month view. |
| Bell | Shift report and closing for the day. |
| Gear | Backup, restore, mute, reset, send papers to another device. |

## Features

- **XP and ranks.** Done = 10 XP, done on time = 15, denied = 3. Seven ranks, from Junior Clerk to Director of the Bureau. Each rank lets you pick something for your desk: a plant, tea, a cat, a radio, blue ink, a lamp or a certificate.
- **Quota and streak.** Set a daily quota. Hit it and your streak grows.
- **Commendations.** Eight achievements, delivered as letters with the morning post.
- **Urgent tasks.** Write "urgent", "asap" or "deadline" and the paper gets a red stripe and is pinned to the top of the desk.
- **Auto-filing.** Each task is sorted into a department: Correspondence, Errands, Study Orders, Treasury, Wellbeing, Meetings or Creative Commissions.
- **Duplicate check.** If a new task looks like one you already have, the paper gets a pencilled note.
- **Phone.** The desk rearranges itself for phones. To move tasks from your phone to your computer, use Gear → Send papers to another desk and open the link on the other device.

## ML under the hood

Auto-filing and the duplicate check use a small language model, [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2), running in your browser through [Transformers.js](https://github.com/xenova/transformers.js).

- **Embeddings.** The model turns each task into a list of 384 numbers. Tasks that mean similar things get similar numbers.
- **Filing.** Every department has a few example tasks. A new task goes to the department with the closest example. The number on the paper ("filed by the Clerk · 0.42") is how close it was.
- **Duplicates.** A new task is compared with your open ones. Above 0.88 similarity it gets the "similar to No. 0042?" note. Tasks under three words are skipped.
- **Why in the browser.** Your tasks stay on your device. The model downloads once (about 23 MB) and is cached after that. While it loads, tasks are filed by keyword.

## Your data

Tasks are saved in your browser, so every visitor has their own desk. Use Gear → Export backup to keep a copy.

## Run it locally

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages**.
3. Set **Source** to "Deploy from a branch", pick `main` and `/ (root)`, and save.
4. The site appears at `https://<username>.github.io/<repository>/` after a minute.
