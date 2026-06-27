# Supabase Auth email branding (Equipd)

Manual dashboard configuration only — not applied by migrations or deploy scripts.

## Dashboard checklist

### 1. URL configuration

**Authentication → URL Configuration**

| Setting | Value |
|---------|--------|
| Site URL | `https://equipd.co.uk` |
| Redirect URLs | `https://equipd.co.uk/**`, `https://www.equipd.co.uk/**`, `http://localhost:5174/**` |

### 2. Custom SMTP (required for production “from” branding)

Default Supabase mail (`noreply@mail.app.supabase.io`) cannot show **Equipd** as sender or use `@equipd.co.uk`.

**Authentication → Emails → SMTP Settings → Enable Custom SMTP**

Recommended (Resend — already used for support alerts):

| Field | Value |
|-------|--------|
| Sender name | `Equipd` |
| Sender email | `auth@equipd.co.uk` (or `notifications@equipd.co.uk` if one inbox) |
| Host | `smtp.resend.com` |
| Port | `465` (SSL) or `587` (STARTTLS) |
| Username | `resend` |
| Password | Resend API key (`re_...`) |

Prerequisites in Resend: verify domain `equipd.co.uk`, add DNS records, optionally create `auth@` as allowed from-address.

### 3. Email templates

**Authentication → Emails → Templates**

Use `{{ .ConfirmationURL }}` for action links (do not hardcode domains). Subjects below.

---

## Confirm signup

**Subject:** `Confirm your Equipd account`

**Body (HTML):**

```html
<h2>Welcome to Equipd</h2>
<p>Thanks for signing up. Confirm your email to start buying and selling gym equipment.</p>
<p><a href="{{ .ConfirmationURL }}">Confirm my email</a></p>
<p>This link expires soon. If you didn&apos;t create an Equipd account, you can ignore this email.</p>
<p>— The Equipd team</p>
```

---

## Reset password

**Subject:** `Reset your Equipd password`

**Body (HTML):**

```html
<h2>Reset your password</h2>
<p>We received a request to reset the password for your Equipd account ({{ .Email }}).</p>
<p><a href="{{ .ConfirmationURL }}">Choose a new password</a></p>
<p>If you didn&apos;t ask for this, you can safely ignore this email. Your password won&apos;t change.</p>
<p>— The Equipd team</p>
```

*App note: password reset UI is not implemented yet; template is ready when `resetPasswordForEmail` is added with `redirectTo: getEmailAuthRedirectUrl()`.*

---

## Magic link (if enabled later)

**Subject:** `Your Equipd sign-in link`

**Body (HTML):**

```html
<h2>Sign in to Equipd</h2>
<p>Use the link below to sign in to your account. No password needed.</p>
<p><a href="{{ .ConfirmationURL }}">Sign in to Equipd</a></p>
<p>If you didn&apos;t request this link, you can ignore this email.</p>
<p>— The Equipd team</p>
```

---

## Change email address

**Subject:** `Confirm your new Equipd email`

**Body (HTML):**

```html
<h2>Confirm your new email</h2>
<p>You asked to change the email on your Equipd account to {{ .Email }}.</p>
<p><a href="{{ .ConfirmationURL }}">Confirm new email</a></p>
<p>If this wasn&apos;t you, contact us at <a href="mailto:support@equipd.co.uk">support@equipd.co.uk</a>.</p>
<p>— The Equipd team</p>
```

*App note: Settings currently shows email as read-only; enable template before adding in-app email change.*

---

## App code (redirect targets)

- `signUp` passes `emailRedirectTo: getEmailAuthRedirectUrl()` → `https://equipd.co.uk/auth/callback` in production.
- Google OAuth uses the same `/auth/callback` path.
- Future `resetPasswordForEmail` / magic link should use `getEmailAuthRedirectUrl()` from `src/lib/auth.js`.
