# Your Blog — Setup Guide

## File structure
```
/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── supabase.js
│   └── app.js
└── SUPABASE_SETUP.sql
```

---

## Step 1 — Set up the Supabase database

1. Go to your Supabase dashboard → **SQL Editor → New Query**
2. Paste the entire contents of `SUPABASE_SETUP.sql` and hit **Run**
3. You should see two tables created: `posts` and `about`

---

## Step 2 — Create your admin account

1. In Supabase dashboard go to **Authentication → Users → Invite User**
2. Enter your email and send the invite
3. Check your email and set a password
4. That's your login — no one else can sign up

---

## Step 3 — Deploy to GitHub Pages

1. Create a new **public** GitHub repository (e.g. `my-blog`)
2. Push all files to the `main` branch
3. Go to repo **Settings → Pages**
4. Set source to `main` branch, root folder `/`
5. Your site will be live at `https://yourusername.github.io/my-blog`

---

## How to log in on the live site

The login is hidden — **click the site title 5 times quickly**. A login box will appear. Use the email and password you set in Step 2.

Once logged in, a small ⚙ button appears in the nav. That's your admin panel.

---

## How to publish a post

1. Click ⚙ in the nav
2. Click **+ New Post**
3. Write your title, optional subtitle, pick a category, write your body
4. Body supports basic Markdown: `**bold**`, `*italic*`, `## headings`, `> blockquotes`, `---` for dividers
5. Hit **Publish**

That's it. No git, no code, no terminal.

---

## Customising the site name

Open `index.html` and find `THE SITE` — replace with whatever you want.
