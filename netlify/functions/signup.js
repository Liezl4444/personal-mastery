// signup.js — GIBS Personal Mastery Campaign Experience
// Netlify Function: receives application form data, stores to Netlify Blob,
// sends confirmation email to applicant, sends notification to GIBS admin.
//
// Environment variables required (set in Netlify Dashboard → Site settings → Environment variables):
//   ANTHROPIC_API_KEY        — Claude API key (for reflect.js)
//   GIBS_ADMIN_EMAIL         — email address for admin notifications (e.g. personalmastery@gibs.co.za)
//   SENDGRID_API_KEY         — SendGrid API key for outbound email
//   FROM_EMAIL               — verified sender address in SendGrid (e.g. noreply@gibs.co.za)
//   BLOB_STORE_TOKEN         — Netlify Blob token (auto-available in Netlify Functions, but can be set manually)

const { getStore } = require('@netlify/blobs');

exports.handler = async function (event, context) {

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed.' }) };
  }

  // ── Parse body ──────────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const {
    firstName,
    surname,
    email,
    phone,
    commitDates,
    commitHours,
    commitDevice,
    marketingOptIn
  } = body;

  // ── Validate required fields ─────────────────────────────────────────
  if (!firstName || !surname || !email || !phone) {
    return { statusCode: 400, body: JSON.stringify({ error: 'All required fields must be completed.' }) };
  }
  if (!commitDates || !commitHours || !commitDevice) {
    return { statusCode: 400, body: JSON.stringify({ error: 'All three commitment confirmations are required.' }) };
  }

  // ── Email format check ───────────────────────────────────────────────
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Please provide a valid email address.' }) };
  }

  // ── Length guards ────────────────────────────────────────────────────
  if (
    firstName.length > 100 || surname.length > 100 ||
    email.length > 254   || phone.length > 30
  ) {
    return { statusCode: 400, body: JSON.stringify({ error: 'One or more fields exceed the maximum length.' }) };
  }

  // ── Build application record ─────────────────────────────────────────
  const submittedAt = new Date().toISOString();
  const applicationId = `pm-lfw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const record = {
    applicationId,
    submittedAt,
    firstName:     firstName.trim(),
    surname:       surname.trim(),
    email:         email.trim().toLowerCase(),
    phone:         phone.trim(),
    commitDates,
    commitHours,
    commitDevice,
    marketingOptIn: !!marketingOptIn,
    source:        'campaign-experience-web',
    campaign:      'personal-mastery-lfw-2026',
    status:        'received'
  };

  // ── Store to Netlify Blob ────────────────────────────────────────────
  // Blob key: applications/{applicationId}
  // This gives Farzana's team a queryable store of all applicants.
  try {
    const store = getStore({
      name: 'pm-applications',
      siteID:  process.env.NETLIFY_SITE_ID,
      token:   process.env.BLOB_STORE_TOKEN || process.env.NETLIFY_TOKEN
    });
    await store.setJSON(applicationId, record);
  } catch (blobErr) {
    console.error('Blob storage error:', blobErr);
    // Don't fail the whole submission if Blob fails — log and continue.
    // The email notification to admin will still fire.
    console.warn('Application NOT saved to Blob. Proceeding with email only.');
  }

  // ── Send emails via SendGrid ─────────────────────────────────────────
  const sgKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || 'noreply@gibs.co.za';
  const adminEmail = process.env.GIBS_ADMIN_EMAIL || 'digitallearning@gibs.co.za';

  if (sgKey) {
    try {
      // ── Confirmation to applicant ──────────────────────────────────
      const confirmationBody = {
        personalizations: [{
          to: [{ email: record.email, name: `${record.firstName} ${record.surname}` }],
          subject: `Application received — Personal Mastery: Lead from Within`
        }],
        from: { email: fromEmail, name: 'GIBS Digital Education' },
        content: [{
          type: 'text/html',
          value: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:system-ui,-apple-system,Arial,sans-serif;background:#f7f6f4;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:#002c77;padding:28px 32px;">
      <p style="color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px;">GIBS Digital Education</p>
      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;line-height:1.3;">Personal Mastery:<br />Lead from Within</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#1c1c1e;font-size:16px;margin:0 0 16px;">Dear ${record.firstName},</p>
      <p style="color:#3d3d40;font-size:15px;line-height:1.7;margin:0 0 16px;">Thank you — your application for a sponsored seat on the <strong>Personal Mastery: Lead from Within</strong> Professional Development Course has been received.</p>
      <p style="color:#3d3d40;font-size:15px;line-height:1.7;margin:0 0 24px;">We received a number of applications and will contact you directly if you are selected. Please keep an eye on this inbox.</p>
      <div style="background:#f7f6f4;border-radius:10px;padding:20px 24px;margin:0 0 24px;">
        <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#002c77;margin:0 0 12px;">What happens next</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;font-size:13px;color:#002c77;font-weight:700;width:90px;vertical-align:top;">16 Sept</td><td style="padding:6px 0;font-size:13px;color:#3d3d40;line-height:1.5;">Applications close. Eligible applicants selected at random.</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#002c77;font-weight:700;vertical-align:top;">Late Sept</td><td style="padding:6px 0;font-size:13px;color:#3d3d40;line-height:1.5;">Successful applicants contacted with course access instructions.</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#002c77;font-weight:700;vertical-align:top;">1 October</td><td style="padding:6px 0;font-size:13px;color:#3d3d40;line-height:1.5;">Course access opens. Runs to 31 October 2026.</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#002c77;font-weight:700;vertical-align:top;">Completion</td><td style="padding:6px 0;font-size:13px;color:#3d3d40;line-height:1.5;">GIBS Certificate of Completion and Digital Credential via Credly.</td></tr>
        </table>
      </div>
      <p style="color:#6e6e73;font-size:13px;line-height:1.6;margin:0 0 8px;">Your application reference: <strong>${applicationId}</strong></p>
      <p style="color:#6e6e73;font-size:13px;line-height:1.6;margin:0;">Questions? Contact us at <a href="mailto:${adminEmail}" style="color:#002c77;">${adminEmail}</a></p>
    </div>
    <div style="background:#001440;padding:16px 32px;text-align:center;">
      <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:0;">Gordon Institute of Business Science, University of Pretoria &nbsp;·&nbsp; gibs.co.za</p>
    </div>
  </div>
</body>
</html>`
        }]
      };

      // ── Admin notification ─────────────────────────────────────────
      const adminBody = {
        personalizations: [{
          to: [{ email: adminEmail }],
          subject: `New PM:LFW application — ${record.firstName} ${record.surname}`
        }],
        from: { email: fromEmail, name: 'GIBS Campaign Experience' },
        content: [{
          type: 'text/html',
          value: `
<html><body style="font-family:system-ui,Arial,sans-serif;padding:20px;max-width:560px;">
<h2 style="color:#002c77;">New Application Received</h2>
<p style="font-size:13px;color:#666;">Personal Mastery: Lead from Within — Campaign Experience</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px;">
  <tr style="background:#f7f6f4;"><td style="padding:10px 12px;font-size:13px;font-weight:600;width:140px;">Application ID</td><td style="padding:10px 12px;font-size:13px;">${applicationId}</td></tr>
  <tr><td style="padding:10px 12px;font-size:13px;font-weight:600;">Submitted</td><td style="padding:10px 12px;font-size:13px;">${new Date(submittedAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}</td></tr>
  <tr style="background:#f7f6f4;"><td style="padding:10px 12px;font-size:13px;font-weight:600;">First name</td><td style="padding:10px 12px;font-size:13px;">${record.firstName}</td></tr>
  <tr><td style="padding:10px 12px;font-size:13px;font-weight:600;">Surname</td><td style="padding:10px 12px;font-size:13px;">${record.surname}</td></tr>
  <tr style="background:#f7f6f4;"><td style="padding:10px 12px;font-size:13px;font-weight:600;">Email</td><td style="padding:10px 12px;font-size:13px;"><a href="mailto:${record.email}">${record.email}</a></td></tr>
  <tr><td style="padding:10px 12px;font-size:13px;font-weight:600;">Phone</td><td style="padding:10px 12px;font-size:13px;">${record.phone}</td></tr>
  <tr style="background:#f7f6f4;"><td style="padding:10px 12px;font-size:13px;font-weight:600;">Commits: dates</td><td style="padding:10px 12px;font-size:13px;">${record.commitDates ? '✓ Yes' : '✗ No'}</td></tr>
  <tr><td style="padding:10px 12px;font-size:13px;font-weight:600;">Commits: hours</td><td style="padding:10px 12px;font-size:13px;">${record.commitHours ? '✓ Yes' : '✗ No'}</td></tr>
  <tr style="background:#f7f6f4;"><td style="padding:10px 12px;font-size:13px;font-weight:600;">Commits: device</td><td style="padding:10px 12px;font-size:13px;">${record.commitDevice ? '✓ Yes' : '✗ No'}</td></tr>
  <tr><td style="padding:10px 12px;font-size:13px;font-weight:600;">Marketing opt-in</td><td style="padding:10px 12px;font-size:13px;">${record.marketingOptIn ? '✓ Yes' : 'No'}</td></tr>
</table>
<p style="margin-top:20px;font-size:12px;color:#888;">Source: ${record.source} &nbsp;·&nbsp; Campaign: ${record.campaign}</p>
</body></html>`
        }]
      };

      // Send both emails in parallel
      await Promise.all([
        fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sgKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(confirmationBody)
        }),
        fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sgKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(adminBody)
        })
      ]);

    } catch (emailErr) {
      console.error('Email send error:', emailErr);
      // Email failure should NOT fail the submission from the user's perspective
      // Data is already in Blob. Log and continue.
    }
  } else {
    console.warn('SENDGRID_API_KEY not set. Emails not sent. Application stored in Blob only.');
  }

  // ── Success ──────────────────────────────────────────────────────────
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      applicationId,
      message: `Application received for ${record.firstName} ${record.surname}.`
    })
  };
};
