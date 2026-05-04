function emailHeader(title: string, subtitle?: string) {
  return `
  <div style="background:linear-gradient(135deg,#07111F 0%,#0f2744 100%);padding:24px 32px;text-align:center">
    <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="width:38px;height:38px;border-radius:9px;background:#F47920;color:#fff;font-weight:800;font-size:14px;display:inline-flex;align-items:center;justify-content:center">IC</div>
      <span style="font-size:18px;font-weight:800;color:#fff">Imperial CRM</span>
    </div>
    <div style="display:inline-block;background:#fff2;color:#fff;border:1px solid #fff3;border-radius:20px;padding:3px 14px;font-size:12px;font-weight:700">${title}</div>
    ${subtitle ? `<p style="color:#bfdbfe;margin:6px 0 0;font-size:12px">${subtitle}</p>` : ''}
  </div>`
}

function emailFooter() {
  return `<p style="font-size:11px;color:#94a3b8;text-align:center;margin:16px 0 0">Imperial Tech Innovations Pvt Ltd · GSTIN: 06AAICI5025Q1Z6 · This is an automated message, please do not reply.</p>`
}

function getMailConfig() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? '465')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465

  if (!host || !port || !user || !pass || !from) {
    throw new Error('Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.')
  }

  return { host, port, user, pass, from, secure }
}

async function createTransporter() {
  const { host, port, user, pass, from, secure } = getMailConfig()
  const nodemailerModule = await import('nodemailer')
  const nodemailer = (nodemailerModule.default ?? nodemailerModule) as typeof nodemailerModule
  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
  return { transporter, from }
}

/* ── OTP / SIGN-IN ─────────────────────────────────────────── */
export async function sendOtpEmail(params: {
  to: string
  name: string
  otp: string
  expiresInMinutes: number
}) {
  const { to, name, otp, expiresInMinutes } = params
  const { transporter, from } = await createTransporter()

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.06)">
      ${emailHeader('Sign-in Code', 'One-time password for Imperial CRM')}
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#1e293b;margin:0 0 6px">Hello <strong>${name}</strong>,</p>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.6">
          Use the code below to sign in to Imperial CRM. It expires in <strong>${expiresInMinutes} minutes</strong>.
        </p>
        <div style="margin:0 0 20px;padding:20px;border-radius:14px;background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);border:1px solid #fdba74;text-align:center">
          <div style="font-size:34px;font-weight:800;letter-spacing:12px;color:#c2410c">${otp}</div>
        </div>
        <p style="font-size:12px;color:#94a3b8;margin:0">If you did not request this code, please ignore this email.</p>
        ${emailFooter()}
      </div>
    </div>
  </div>`

  await transporter.sendMail({
    from, to,
    subject: 'Your Imperial CRM sign-in code',
    html,
    text: `Hello ${name},\n\nYour Imperial CRM OTP is: ${otp}\n\nThis code expires in ${expiresInMinutes} minutes.\n\nIf you did not request this, ignore this email.`,
  })
}

/* ── WELCOME (new org / super_admin) ───────────────────────── */
export async function sendWelcomeEmail(params: {
  to: string
  name: string
  orgName: string
  planTier: string
  loginUrl?: string
}) {
  const { to, name, orgName, planTier, loginUrl = 'https://imperialcrm.cloud/login' } = params
  const { transporter, from } = await createTransporter()

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.06)">
      ${emailHeader('Welcome to Imperial CRM!', 'Your CRM workspace is ready')}
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#1e293b;margin:0 0 6px">Dear <strong>${name}</strong>,</p>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.7">
          Welcome to <strong>Imperial CRM</strong>! Your workspace for <strong>${orgName}</strong> has been set up on the <strong>${planTier.charAt(0).toUpperCase() + planTier.slice(1)}</strong> plan.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;margin-bottom:20px;border:1px solid #e5e7eb">
          <tr style="background:#f1f5f9"><td colspan="2" style="padding:10px 16px;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em">Workspace Details</td></tr>
          ${[['Organisation', orgName], ['Plan', planTier.charAt(0).toUpperCase() + planTier.slice(1)], ['Login URL', loginUrl]].map(([k, v]) => `<tr><td style="padding:9px 16px;font-size:12px;color:#6b7280;width:140px;border-top:1px solid #f1f5f9">${k}</td><td style="padding:9px 16px;font-size:12px;font-weight:600;color:#1e293b;border-top:1px solid #f1f5f9">${v}</td></tr>`).join('')}
        </table>
        <a href="${loginUrl}" style="display:inline-block;background:#F47920;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:20px">Sign In to Imperial CRM</a>
        <p style="font-size:12px;color:#94a3b8;margin:0">Need help? Contact us at <a href="mailto:support@imperialcrm.cloud" style="color:#F47920">support@imperialcrm.cloud</a></p>
        ${emailFooter()}
      </div>
    </div>
  </div>`

  await transporter.sendMail({
    from, to,
    subject: `Welcome to Imperial CRM — ${orgName} is ready!`,
    html,
    text: `Dear ${name},\n\nWelcome to Imperial CRM!\n\nOrganisation: ${orgName}\nPlan: ${planTier}\nLogin: ${loginUrl}\n\nNeed help? support@imperialcrm.cloud`,
  })
}

/* ── TRIAL EXPIRY REMINDER ──────────────────────────────────── */
export async function sendTrialExpiryEmail(params: {
  to: string
  name: string
  orgName: string
  daysLeft: number
  upgradeUrl?: string
}) {
  const { to, name, orgName, daysLeft, upgradeUrl = 'https://imperialcrm.cloud/settings/billing' } = params
  const { transporter, from } = await createTransporter()

  const urgency = daysLeft <= 1 ? 'Last day!' : daysLeft <= 3 ? 'Expiring soon' : `${daysLeft} days left`

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.06)">
      ${emailHeader('Trial Expiring', urgency)}
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#1e293b;margin:0 0 6px">Dear <strong>${name}</strong>,</p>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.7">
          Your free trial for <strong>${orgName}</strong> on Imperial CRM expires in <strong style="color:#dc2626">${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.
          Upgrade now to keep your data and continue without interruption.
        </p>
        <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:10px;padding:16px;font-size:13px;color:#991b1b;margin-bottom:20px">
          After expiry, your workspace will be locked and data archived for 30 days before permanent deletion.
        </div>
        <a href="${upgradeUrl}" style="display:inline-block;background:#F47920;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:20px">Upgrade Now</a>
        <p style="font-size:12px;color:#94a3b8;margin:0">Questions? <a href="mailto:support@imperialcrm.cloud" style="color:#F47920">support@imperialcrm.cloud</a></p>
        ${emailFooter()}
      </div>
    </div>
  </div>`

  await transporter.sendMail({
    from, to,
    subject: `Imperial CRM Trial Expiring — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left for ${orgName}`,
    html,
    text: `Dear ${name},\n\nYour Imperial CRM trial for ${orgName} expires in ${daysLeft} day(s). Upgrade at: ${upgradeUrl}`,
  })
}

/* ── CREDIT LOW-BALANCE ALERT ───────────────────────────────── */
export async function sendCreditAlertEmail(params: {
  to: string
  name: string
  orgName: string
  creditsRemaining: number
  topUpUrl?: string
}) {
  const { to, name, orgName, creditsRemaining, topUpUrl = 'https://imperialcrm.cloud/settings/billing' } = params
  const { transporter, from } = await createTransporter()

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.06)">
      ${emailHeader('Low AI Credits', 'Your Imperial Intelligence balance is low')}
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#1e293b;margin:0 0 6px">Dear <strong>${name}</strong>,</p>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.7">
          <strong>${orgName}</strong>'s Imperial Intelligence credit balance is running low.
        </p>
        <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Credits Remaining</div>
          <div style="font-size:42px;font-weight:800;color:#d97706">${creditsRemaining.toLocaleString()}</div>
        </div>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.6">
          AI-powered features (lead scoring, email drafting, document analysis) will be unavailable once credits reach zero. Top up now to avoid interruption.
        </p>
        <a href="${topUpUrl}" style="display:inline-block;background:#F47920;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:20px">Top Up Credits</a>
        ${emailFooter()}
      </div>
    </div>
  </div>`

  await transporter.sendMail({
    from, to,
    subject: `Low Imperial Intelligence Credits — ${creditsRemaining.toLocaleString()} remaining for ${orgName}`,
    html,
    text: `Dear ${name},\n\n${orgName} has ${creditsRemaining} Imperial Intelligence credits remaining. Top up at: ${topUpUrl}`,
  })
}

/* ── INVOICE EMAIL ──────────────────────────────────────────── */
export async function sendInvoiceEmail(params: {
  to: string
  name: string
  orgName: string
  invoiceNumber: string
  amount: string
  period: string
  dueDate: string
  invoiceUrl?: string
}) {
  const { to, name, orgName, invoiceNumber, amount, period, dueDate, invoiceUrl } = params
  const { transporter, from } = await createTransporter()

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.06)">
      ${emailHeader('Invoice Generated', `Invoice ${invoiceNumber}`)}
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#1e293b;margin:0 0 6px">Dear <strong>${name}</strong>,</p>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.6">
          Your invoice for Imperial CRM subscription has been generated.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;margin-bottom:20px;border:1px solid #e5e7eb">
          <tr style="background:#f1f5f9"><td colspan="2" style="padding:10px 16px;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em">Invoice Details</td></tr>
          ${[['Invoice #', invoiceNumber], ['Organisation', orgName], ['Period', period], ['Due Date', fmt(dueDate)]].map(([k, v]) => `<tr><td style="padding:9px 16px;font-size:12px;color:#6b7280;width:140px;border-top:1px solid #f1f5f9">${k}</td><td style="padding:9px 16px;font-size:12px;font-weight:600;color:#1e293b;border-top:1px solid #f1f5f9">${v}</td></tr>`).join('')}
        </table>
        <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Amount Due</div>
          <div style="font-size:36px;font-weight:800;color:#15803d">${amount}</div>
        </div>
        ${invoiceUrl ? `<a href="${invoiceUrl}" style="display:inline-block;background:#F47920;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:20px">View & Pay Invoice</a>` : ''}
        <p style="font-size:12px;color:#94a3b8;margin:0">Questions? <a href="mailto:billing@imperialcrm.cloud" style="color:#F47920">billing@imperialcrm.cloud</a></p>
        ${emailFooter()}
      </div>
    </div>
  </div>`

  await transporter.sendMail({
    from, to,
    subject: `Invoice ${invoiceNumber} — ${amount} due on ${fmt(dueDate)}`,
    html,
    text: `Dear ${name},\n\nInvoice ${invoiceNumber} for ${orgName}.\nAmount: ${amount}\nDue: ${fmt(dueDate)}\n${invoiceUrl ? `View: ${invoiceUrl}` : ''}`,
  })
}

/* ── TEAM MEMBER INVITE ─────────────────────────────────────── */
export async function sendInviteEmail(params: {
  to: string
  name: string
  invitedBy: string
  orgName: string
  role: string
  loginUrl?: string
}) {
  const { to, name, invitedBy, orgName, role, loginUrl = 'https://imperialcrm.cloud/login' } = params
  const { transporter, from } = await createTransporter()
  const roleLabel = role.replace(/_/g, ' ')

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.06)">
      ${emailHeader('You have been invited', `Join ${orgName} on Imperial CRM`)}
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#1e293b;margin:0 0 6px">Hello <strong>${name}</strong>,</p>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.6">
          <strong>${invitedBy}</strong> has invited you to join <strong>${orgName}</strong> on Imperial CRM as <strong>${roleLabel}</strong>.
        </p>
        <p style="font-size:13px;color:#374151;margin:0 0 16px;line-height:1.6">
          To activate your account:
        </p>
        <ol style="font-size:13px;color:#475569;line-height:1.8;margin:0 0 20px;padding-left:18px">
          <li>Click <strong>Sign in to Imperial CRM</strong> below.</li>
          <li>Enter your email <strong style="color:#1e293b">${to}</strong>.</li>
          <li>Click <strong>Send sign-in code</strong> — we&apos;ll email you a 6-digit OTP.</li>
          <li>Enter the OTP to access your workspace.</li>
        </ol>
        <a href="${loginUrl}" style="display:inline-block;background:#F47920;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:20px">Sign in to Imperial CRM</a>
        <p style="font-size:12px;color:#94a3b8;margin:0">If you were not expecting this invitation, please ignore this email.</p>
        ${emailFooter()}
      </div>
    </div>
  </div>`

  await transporter.sendMail({
    from, to,
    subject: `You're invited to ${orgName} on Imperial CRM`,
    html,
    text: `Hello ${name},\n\n${invitedBy} has invited you to join ${orgName} on Imperial CRM as ${roleLabel}.\n\nTo activate your account:\n  1. Visit ${loginUrl}\n  2. Enter your email: ${to}\n  3. Click "Send sign-in code" — we will email you a 6-digit OTP\n  4. Enter the OTP to access your workspace\n\nIf you were not expecting this invitation, please ignore this email.`,
  })
}
