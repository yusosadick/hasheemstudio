// Design adapted with owner authorization from Hasheem Gaming email templates.
// Studio assets, branding and copy only; no configuration or customer data imported.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = dirname(fileURLToPath(import.meta.url));

const T = {
  accent: '#ff006e',
  accentDeep: '#ff6b35',
  accentInk: '#b5004e',
  accentDark: '#ff8bbd',

  page: '#EEF0F5',
  card: '#FFFFFF',
  cardEdge: '#E6E9EF',
  hairline: '#EDEFF4',

  ink: '#0E1119',
  muted: '#586274', // 6.3:1 on white
  faint: '#8A93A5',

  masthead: '#111111',

  codeBg: '#FFF5F4',
  codeEdge: '#F8DCD9',
  tile: '#FFFFFF',
  tileEdge: '#F1D6D3',

  dPage: '#0B0D12',
  dCard: '#14161E',
  dCardEdge: '#242835',
  dInk: '#F5F7FA',
  dMuted: '#A7B1C2',
  dFaint: '#7C8697',
  dCodeBg: '#1F1518',
  dCodeEdge: '#3E2429',
  dTile: '#171A22',
  dTileEdge: '#2F3542',
};

const ASSET_V = '3';
const ASSET_BASE = 'https://hasheemstudio.com/auth-email-assets';
const MASTHEAD = `${ASSET_BASE}/email-masthead.png?v=${ASSET_V}`;

const SITE_URL = 'https://hasheemstudio.com';
const SITE_LABEL = 'hasheemstudio.com';
const INSTAGRAM = 'https://hasheemstudio.com/privacy';
const TIKTOK = 'https://hasheemstudio.com/terms';
const SUPPORT = 'support@hasheemstudio.com';

const FONT_DISPLAY = `'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const FONT_BODY = `'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const FONT_MONO = `'SF Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace`;

const RND = 'border-collapse:separate;border-spacing:0;';

const TEMPLATES = [
  {
    file: 'confirm-signup.html',
    slot: 'CONFIRMATION',
    subject: 'Confirm your email — Hasheem Studio',
    preheader: 'Enter your 6-digit Hasheem Studio confirmation code to activate your account.',
    h1: 'Confirm your email',
    lead: 'Enter this code on the Hasheem Studio verification page to confirm your account and return to your video.',
    codeLabel: 'Your confirmation code',
    note: 'If you didn&rsquo;t create a Hasheem Studio account, you can safely ignore this email &mdash; your email will remain unverified.',
  },
  {
    file: 'magic-link.html',
    slot: 'MAGIC_LINK',
    subject: "Verify it's you — Hasheem Studio",
    preheader: 'Enter your 6-digit Hasheem Studio verification code to confirm this request.',
    h1: 'Verify it&rsquo;s you',
    lead: 'Hi there, use the code below to confirm it&rsquo;s really you.',
    codeLabel: 'Your verification code',
    note: 'If you didn&rsquo;t start this, ignore this email &mdash; nothing will change. If it keeps happening, change your password.',
  },
  {
    file: 'reset-password.html',
    slot: 'RECOVERY',
    subject: 'Reset your Hasheem Studio password',
    preheader: 'Enter your 6-digit Hasheem Studio reset code to choose a new password.',
    h1: 'Reset your password',
    lead: 'Hi there, use the code below to reset your password.',
    codeLabel: 'Your password reset code',
    note: 'If you didn&rsquo;t ask to reset your password, ignore this email &mdash; your current password still works and nothing has changed.',
  },
  {
    file: 'change-email.html',
    slot: 'EMAIL_CHANGE',
    subject: 'Confirm your new email — Hasheem Studio',
    preheader: 'Enter your 6-digit Hasheem Studio code to confirm your new email address.',
    h1: 'Confirm your new email',
    lead: 'Use the code below to move your account to <strong class="txt-ink" style="color:{{INK}};font-weight:700;">{{ .NewEmail }}</strong>.',
    codeLabel: 'Your confirmation code',
    note: `For your protection we send a separate code to each address, and both must be entered. Didn&rsquo;t request this? Ignore this email and contact <a href="mailto:${SUPPORT}" class="txt-accent" style="color:{{ACCENT_INK}};text-decoration:underline;">${SUPPORT}</a> straight away.`,
  },
  {
    file: 'invite.html',
    slot: 'INVITE',
    subject: "You're invited to Hasheem Studio",
    preheader: 'Enter your 6-digit Hasheem Studio invitation code to claim your account.',
    h1: 'You&rsquo;re invited',
    lead: 'Hi there, use the code below to claim your Hasheem Studio account.',
    codeLabel: 'Your invitation code',
    note: 'If you weren&rsquo;t expecting an invitation, you can safely ignore this email &mdash; no account will be created without this code.',
  },
  {
    file: 'reauthentication.html',
    slot: 'REAUTHENTICATION',
    subject: 'Confirm this change — Hasheem Studio',
    preheader: 'Enter your 6-digit Hasheem Studio code to confirm a sensitive account change.',
    h1: 'Confirm this change',
    lead: 'Hi there, use the code below to confirm this change.',
    codeLabel: 'Your confirmation code',
    note: 'If you didn&rsquo;t start this, ignore this email &mdash; the change will not be applied without this code.',
  },
];


/**
 * Full-bleed masthead. The dark backdrop and red bloom are baked into the JPG
 * (make-assets.py) rather than built from CSS, because the lock-up's lettering is
 * silver chrome that only reads on dark — and a CSS-built dark band is exactly
 * what aggressive dark-mode engines recolour. bgcolor + alt text carry the band
 * when images are blocked.
 */
const mastheadRow = () => `
        <tr>
          <td align="center" bgcolor="${T.masthead}" style="padding:0;background:${T.masthead};font-size:0;line-height:0;">
            <img src="${MASTHEAD}" width="600" height="230" alt="Hasheem Studio" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" />
          </td>
        </tr>
        <!-- accent rule: gradient where supported, solid red everywhere else -->
        <tr>
          <td bgcolor="${T.accent}" height="3" style="height:3px;font-size:0;line-height:0;background:${T.accent};background:linear-gradient(90deg,${T.accentDeep} 0%,${T.accent} 50%,${T.accentDeep} 100%);">&nbsp;</td>
        </tr>`;

/**
 * The code panel: label, the code itself in one large chip, and the copy hint.
 *
 * This used to render the token as six separate tiles AND repeat it underneath in a
 * small line, showing the same six digits twice. The tiles are gone and the chip is
 * the code now — bigger than either was, and one element instead of two.
 *
 * That also retired the length guard this file used to need. It existed because Go's
 * `slice` errors on a token shorter than six characters, and an erroring template
 * makes GoTrue send nothing at all — a silent auth outage. Nothing slices the token
 * any more, so there is nothing to guard: the token renders at any length, and
 * changing GOTRUE_MAILER_OTP_LENGTH can no longer break these emails.
 *
 * There is no copy control. A working one is not buildable in email: clients strip
 * `<script>`, so the clipboard API is unavailable, and a CSS `:active` swap would
 * report "Copied!" without ever touching the clipboard — a control that lies. An
 * earlier pass shipped a COPY label plus a "tap and hold" hint as an honest stand-in;
 * both are gone now because around a six-digit code they were decoration, and the
 * gesture they described works whether or not the email mentions it.
 *
 * Keeping the code as one contiguous run still matters: it is what lets iOS/Android
 * one-time-code autofill find it, and what makes select-and-copy give you the whole
 * code. Six separate tiles never did either.
 *
 * Left padding on the code cell is deliberately larger than the right: `letter-spacing`
 * applies after the final digit too, so equal padding renders visibly off-centre.
 */
const codeBlock = (label) => `
        <tr>
          <td class="px" style="padding:2px 44px 0 44px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.codeBg}" class="code" style="background:${T.codeBg};border:1px solid ${T.codeEdge};border-radius:22px;${RND}">
              <tr>
                <td align="center" class="txt-muted" style="padding:26px 16px 16px 16px;font-family:${FONT_BODY};font-size:11px;font-weight:800;letter-spacing:2.2px;text-transform:uppercase;color:${T.muted};">${label}</td>
              </tr>
              <tr>
                <td align="center" style="padding:0 14px 26px 14px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${T.tile}" class="tile" style="background:${T.tile};border:1px solid ${T.tileEdge};border-radius:16px;${RND}">
                    <tr>
                      <td valign="middle" class="txt-ink code-run" style="padding:17px 22px 17px 29px;font-family:${FONT_MONO};font-size:32px;font-weight:700;letter-spacing:7px;line-height:1.15;color:${T.ink};mso-line-height-rule:exactly;">{{ .Token }}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;

/** The security reminder and the "didn't request this" note, as plain lines. */
const plainLines = (note) => `
        <tr>
          <td class="px txt-muted" style="padding:24px 44px 0 44px;font-family:${FONT_BODY};font-size:14px;line-height:1.65;color:${T.muted};">For your security this code can only be used once, and it expires soon.</td>
        </tr>
        <tr>
          <td class="px txt-faint" style="padding:10px 44px 0 44px;font-family:${FONT_BODY};font-size:13px;line-height:1.65;color:${T.faint};">${note}</td>
        </tr>`;

const footer = () => `
        <tr>
          <td class="px" style="padding:34px 44px 0 44px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="rule" height="1" style="height:1px;border-top:1px solid ${T.hairline};font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="px txt-ink" align="center" style="padding:24px 44px 8px 44px;font-family:${FONT_DISPLAY};font-size:12px;font-weight:800;letter-spacing:2.6px;color:${T.ink};">HASHEEM STUDIO</td>
        </tr>
        <tr>
          <td class="px txt-faint" align="center" style="padding:0 44px;font-family:${FONT_BODY};font-size:12px;line-height:1.9;color:${T.faint};">
            <a href="${SITE_URL}" target="_blank" class="txt-accent" style="color:${T.accentInk};text-decoration:none;font-weight:700;">${SITE_LABEL}</a>
            <span class="txt-faint" style="color:${T.faint};">&nbsp;&middot;&nbsp;</span>
            <a href="${INSTAGRAM}" target="_blank" class="txt-faint" style="color:${T.faint};text-decoration:none;">Privacy</a>
            <span class="txt-faint" style="color:${T.faint};">&nbsp;&middot;&nbsp;</span>
            <a href="${TIKTOK}" target="_blank" class="txt-faint" style="color:${T.faint};text-decoration:none;">Terms</a>
          </td>
        </tr>
        <tr>
          <td class="px txt-faint" align="center" style="padding:14px 44px 34px 44px;font-family:${FONT_BODY};font-size:11px;line-height:1.7;color:${T.faint};">
            Never share this code. Hasheem Studio staff will never ask you for it.<br />
            Questions? <a href="mailto:${SUPPORT}" class="txt-faint" style="color:${T.faint};text-decoration:underline;">${SUPPORT}</a>
          </td>
        </tr>`;


const render = (t) => {
  const lead = t.lead.replace(/\{\{INK\}\}/g, T.ink).replace(/\{\{ACCENT_INK\}\}/g, T.accentInk);
  const note = t.note.replace(/\{\{ACCENT_INK\}\}/g, T.accentInk);

  return `<!DOCTYPE html>
<!-- Hasheem Studio — Supabase Auth (GoTrue) ${t.slot} template.
     Subject: ${t.subject}
     GENERATED FILE — edit build.mjs and re-run \`node supabase/auth-email-templates/build.mjs\`.
     Verification is by 6-digit code only. This template deliberately references no
     ConfirmationURL. The name is written bare on purpose: Go's template engine
     executes actions inside HTML comments too, so spelling one out here would both
     inject a live one-click confirm link into the email source and -- if malformed --
     fail to parse, which makes GoTrue send nothing at all. -->
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<!-- Stops iOS turning the 6-digit code into a tappable phone number. -->
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${t.subject}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a { text-decoration:none; }
  /* iOS data detectors otherwise restyle the code and the support address. */
  a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; font-size:inherit !important; font-family:inherit !important; font-weight:inherit !important; line-height:inherit !important; }

  /* Dark mode. The card, type and panels invert; the masthead does NOT — its
     backdrop is baked into the artwork, so it stays identical in both schemes and
     the brand lock-up never lands on a recoloured band. */
  @media (prefers-color-scheme: dark) {
    .page      { background:${T.dPage} !important; }
    .card      { background:${T.dCard} !important; border-color:${T.dCardEdge} !important; }
    .txt-ink   { color:${T.dInk} !important; }
    .txt-muted { color:${T.dMuted} !important; }
    .txt-faint { color:${T.dFaint} !important; }
    .txt-accent{ color:${T.accentDark} !important; }
    .code      { background:${T.dCodeBg} !important; border-color:${T.dCodeEdge} !important; }
    .tile      { background:${T.dTile} !important; border-color:${T.dTileEdge} !important; }
    .rule      { border-top-color:${T.dCardEdge} !important; }
  }

  /* The code chip is the only element that can outgrow the card, so it is what these
     breakpoints step down. Far less delicate than the six fixed-width tiles it
     replaced: one element, and letter-spacing shrinks along with the font. */
  @media only screen and (max-width:620px) {
    .px       { padding-left:24px !important; padding-right:24px !important; }
    .h1       { font-size:26px !important; }
    .lead     { font-size:15px !important; }
    .code-run { font-size:29px !important; letter-spacing:6px !important; }
  }
  @media only screen and (max-width:480px) {
    .px       { padding-left:18px !important; padding-right:18px !important; }
    .code-run { font-size:25px !important; letter-spacing:5px !important; padding-left:24px !important; padding-right:19px !important; }
  }
  @media only screen and (max-width:400px) {
    .px       { padding-left:14px !important; padding-right:14px !important; }
    .code-run { font-size:22px !important; letter-spacing:4px !important; padding-left:19px !important; padding-right:15px !important; }
  }
  @media only screen and (max-width:340px) {
    .px       { padding-left:10px !important; padding-right:10px !important; }
    .code-run { font-size:19px !important; letter-spacing:3px !important; }
  }
</style>
</head>
<body class="page" bgcolor="${T.page}" style="margin:0;padding:0;background:${T.page};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${t.preheader}</div>
<table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.page}" style="background:${T.page};margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:36px 12px;">
      <!--[if mso | IE]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.card}" style="width:100%;max-width:600px;background:${T.card};border:1px solid ${T.cardEdge};border-radius:26px;overflow:hidden;${RND}">
${mastheadRow()}

        <!-- headline -->
        <tr>
          <td class="px" style="padding:36px 44px 0 44px;">
            <h1 class="h1 txt-ink" style="margin:0;font-family:${FONT_DISPLAY};font-size:31px;font-weight:800;line-height:1.18;letter-spacing:-0.7px;color:${T.ink};">${t.h1}</h1>
          </td>
        </tr>

        <!-- lead -->
        <tr>
          <td class="px" style="padding:12px 44px 26px 44px;">
            <p class="lead txt-muted" style="margin:0;font-family:${FONT_BODY};font-size:16px;line-height:1.65;color:${T.muted};">${lead}</p>
          </td>
        </tr>
${codeBlock(t.codeLabel)}
${plainLines(note)}
${footer()}
      </table>
      <!--[if mso | IE]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>
`;
};

for (const t of TEMPLATES) {
  const html = render(t);
  writeFileSync(join(OUT_DIR, t.file), html, 'utf8');
  console.log(`${t.file.padEnd(24)} ${String(Buffer.byteLength(html)).padStart(6)} bytes  (${t.slot})`);
}