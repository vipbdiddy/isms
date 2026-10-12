# Ism's

A mobile app for keeping the sayings — the "isms" — of people you've lost, and finding the right one when you need it.

- **Loved ones** – add the people you miss with a photo and their obituary, then the things they always used to say (quotes) and longer memories about them (stories). When someone adds a person who's already here (same name and years, or the same obituary), the app asks "Is this who you're looking for?".
- **Ask** – describe what you're going through ("my brother wants to borrow money again") or pick a situation, and get the sayings that fit.
- **Browse** – search everything, and filter by topic and by quotes, stories, or both.
- **Home** – one saying a day, the latest memories from you and your friends, and everything you've saved (♥).
- **Friends** – search for people by name, or (with permission) see which of your contacts use Ism's, and send a friend request; they accept or decline. Friends see the loved ones you share with Friends. "Let people find me" in Settings turns off being found.
- **Kindness review** – shared quotes, stories and loved ones whose words might hurt someone wait for a reviewer before anyone else sees them, and anyone can report something shared. Reviewers allow or remove them on the Review screen.
- **Mine / Friends / Everyone** – every screen can show just your own loved ones, add your friends', or also what other families shared with everyone. Set your default in Settings (⚙).
- **Accounts** – sign in with email (and Google, Apple or Facebook once they're switched on) so memories are kept safe online.
- **Privacy** – each loved one is shared with just you, your friends, or everyone. Either way you can keep individual quotes or stories private. The database enforces this, not just the app.

## Run it

```bash
npm install
npx expo start      # then scan the QR code with Expo Go, or press w for web
npm test            # advice-matching and privacy rules
npm run typecheck

# The web version, as published at https://vipbdiddy.github.io/isms/app/
ISMS_WEB_BASE_URL=/isms/app npx expo export --platform web
```

## How it's built

Expo (React Native) + Expo Router, TypeScript.

| Path | What |
| --- | --- |
| `src/app/(tabs)/` | Home, Ask, Browse, Loved ones, Friends |
| `src/app/settings.tsx` | Settings, opened from the ⚙ button |
| `src/app/review.tsx` | The reviewers' list of held and reported memories |
| `src/app/loved-one/` | Loved-one profile and add/edit form |
| `src/app/ism/edit.tsx` | Add/edit a quote or story |
| `src/lib/photos.ts` | Picking a photo and keeping a copy on the device |
| `src/lib/advice.ts` | Who can see what, the home feed, and matching a situation to sayings |
| `src/lib/duplicates.ts` | Spotting a loved one who's already here ("Is this who you're looking for?") |
| `src/lib/contacts.ts` | Reading contacts' email addresses (with permission) and hashing them on the phone |
| `src/lib/topics.ts` | Situations and the words that suggest them |
| `src/lib/store.tsx` | App state, loaded from and saved to Supabase |
| `src/lib/db.ts`, `src/lib/auth.ts` | Talking to Supabase: data, sign-in |
| `supabase/` | Database setup script and dashboard steps ([setup guide](supabase/README.md)) |
| `public/` | The web version's page, home-screen icons and manifest (paths assume `/isms/app/`) |
| `app.config.js` | Sets the web version's address (`ISMS_WEB_BASE_URL`) only when building it |
| `src/lib/seed.ts` | Example shared families so "Everyone" isn't empty |

## What's next

- Several family members adding to the same loved one, instead of each keeping their own.
- Notifications for friend requests, new memories and things waiting for review.
- A smarter kindness check (an AI model instead of a word list), so fewer harmless memories wait for review.
- Reporting and moderation for shared content.
- Loading shared memories a page at a time once there are many.
- Voice recordings, reminders on birthdays and anniversaries, and smarter matching for "Ask".
