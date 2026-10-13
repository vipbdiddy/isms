# Setting up Supabase for Ism's

The app talks to the Supabase project in `src/lib/config.ts`. These steps are done once, in the Supabase dashboard.

## 1. Create the tables and privacy rules

1. Open **SQL Editor → New query**.
2. Paste the whole of [`schema.sql`](schema.sql) and press **Run**.
3. Supabase warns that the query "includes destructive operations". That's expected: it replaces the privacy rules with the current ones and doesn't delete anyone's data. Click **Run this query**. It should say "Success. No rows returned".

Running it again later is safe, and is how updates to the rules (like friends, groups and comments) are applied.

## 1b. Make yourself a reviewer

Reviewers see the Review screen (Settings → Review shared memories), where shared memories that might be hurtful, and anything people report, wait to be allowed or removed. In **SQL Editor → New query**, run this with the email address you sign in with:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict do nothing;

select u.email from public.admins a join auth.users u on u.id = a.user_id;
```

The second part lists every reviewer, so you can check it worked.

## 2. Email: what works on the free plan

Supabase's built-in email only reaches members of your Supabase organization, about 2 emails an hour, and new free projects can't edit its templates. The app works with the standard emails as they are: confirmation and password-reset emails contain a link that opens the app.

Until you connect your own email service:

1. Open **Authentication → Sign In / Providers → Email** and switch off **Confirm email**, then save. People can sign up without waiting for an email.
2. Password-reset emails will only reach members of your Supabase organization.

Before inviting the public, connect an email service under **Authentication → Emails → SMTP Settings** (Resend and Postmark have free plans; both need a domain name you own). Then switch **Confirm email** back on if you want people to confirm their address.

## 3. Allow the app to receive sign-ins

Open **Authentication → URL Configuration** and, under **Redirect URLs**, add the addresses that email links and social sign-in return to: one for the phone apps, one for the web version.

```
isms://**
https://vipbdiddy.github.io/isms/app/**
```

## 4. Google, Apple and Facebook sign-in (optional, one at a time)

Each provider is switched on under **Authentication → Sign In / Providers**. The callback URL each provider asks for is shown on that page: `https://bxuvjyinsaekyufrewxs.supabase.co/auth/v1/callback`.

- **Google** (free, switched on): an OAuth client of type **Web application** in Google Cloud Console → Google Auth Platform → Clients, with the callback URL above as an authorized redirect URI; its Client ID and Client Secret are in Supabase. While the Google app is in **Testing**, only the test users listed under Google Auth Platform → Audience can sign in. To let anyone sign in, fill in the home page, privacy policy and terms links under **Branding**, then **Publish app** under **Audience**.
- **Facebook** (free): create an app at developers.facebook.com with **Facebook Login**, add the callback URL under Valid OAuth Redirect URIs, and paste its App ID and App Secret into Supabase. Facebook only lets the public sign in after the app passes its review.
- **Apple** (needs an Apple Developer account, $99/year): create a Services ID and a key for **Sign in with Apple**, then fill them into Supabase. Required by Apple if the iPhone app offers Google or Facebook sign-in.

After switching a provider on, add it to `SOCIAL_PROVIDERS` in `src/lib/config.ts`, for example `['google']`, so its button appears.
