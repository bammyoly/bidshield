import nodemailer from 'nodemailer';

/**
 * Sends award email if SMTP is configured.
 * Without SMTP, logs to console so the flow still works in demos.
 */
export async function sendAwardEmail({ to, organizationName, tenderTitle, amount, tenderId }) {
  const subject = `BidShield: You won “${tenderTitle}”`;
  const text = [
    `Congratulations${organizationName ? ` ${organizationName}` : ''}!`,
    ``,
    `Your bid was awarded on BidShield.`,
    ``,
    `Tender: ${tenderTitle}`,
    `Tender ID: ${tenderId}`,
    amount != null ? `Revealed amount: ${amount} tDUST` : null,
    ``,
    `Please follow up with the organizer off-chain to complete the legal contract.`,
    ``,
    `— BidShield (Midnight Preview)`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5">
      <h2 style="color:#e11d48">You won a BidShield tender</h2>
      <p>Congratulations${organizationName ? ` <strong>${organizationName}</strong>` : ''}!</p>
      <p>Your bid was selected by the organizer.</p>
      <ul>
        <li><strong>Tender:</strong> ${tenderTitle}</li>
        <li><strong>Tender ID:</strong> ${tenderId}</li>
        ${amount != null ? `<li><strong>Amount:</strong> ${amount} tDUST</li>` : ''}
      </ul>
      <p style="color:#64748b;font-size:14px">
        Complete the legal award off-chain with the organizer. This email is a notification only.
      </p>
    </div>
  `;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log('\n📧 [DEMO email — SMTP not configured]');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log(text);
    console.log('────────────────────────────\n');
    return { demo: true, to, subject };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to,
    subject,
    text,
    html,
  });

  return { demo: false, to, subject };
}