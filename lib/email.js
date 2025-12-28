import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nafisasz@gmail.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

let resend = null;

function getResend() {
  if (!resend && RESEND_API_KEY) {
    resend = new Resend(RESEND_API_KEY);
  }
  return resend;
}

/**
 * Send an email via Resend
 */
export async function sendEmail({ to, subject, html, text }) {
  const client = getResend();
  if (!client) {
    console.log('Resend not configured, skipping email:', subject);
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
    });

    console.log('Email sent:', subject, 'to:', to);
    return { success: true, id: result.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify admin of new curator application
 */
export async function notifyCuratorApplication(user, curator) {
  const subject = `New Curator Application: ${user.name || user.email}`;

  const html = `
    <h2>New Curator Application</h2>
    <p>A user has applied to become a curator on Nafisa's Closet.</p>

    <h3>Applicant Details</h3>
    <ul>
      <li><strong>Name:</strong> ${user.name || 'Not set'}</li>
      <li><strong>Email:</strong> ${user.email}</li>
      <li><strong>Handle:</strong> @${user.handle || 'Not set'}</li>
      <li><strong>Bio:</strong> ${user.bio || 'Not set'}</li>
      <li><strong>User ID:</strong> ${user.id}</li>
      <li><strong>Curator ID:</strong> ${curator.id}</li>
    </ul>

    <h3>Application Status</h3>
    <p>Status: <strong>${curator.approved ? 'Auto-Approved (MVP)' : 'Pending Review'}</strong></p>

    <hr>
    <p style="color: #666; font-size: 12px;">
      This is an automated message from Nafisa's Closet.
    </p>
  `;

  const text = `
New Curator Application

Applicant Details:
- Name: ${user.name || 'Not set'}
- Email: ${user.email}
- Handle: @${user.handle || 'Not set'}
- Bio: ${user.bio || 'Not set'}
- User ID: ${user.id}
- Curator ID: ${curator.id}

Status: ${curator.approved ? 'Auto-Approved (MVP)' : 'Pending Review'}
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html,
    text,
  });
}

/**
 * Send welcome email to new curator
 */
export async function sendCuratorWelcomeEmail(user, curator) {
  const subject = 'Welcome to Nafisa\'s Closet - You\'re Now a Curator!';

  const html = `
    <h2>Welcome to Nafisa's Closet!</h2>
    <p>Hi ${user.name || 'there'},</p>

    <p>Congratulations! You're now a curator on Nafisa's Closet. You can start posting your fashion finds and earning from your unique style.</p>

    <h3>Getting Started</h3>
    <ol>
      <li><strong>Complete Stripe Onboarding</strong> - Set up your payout account to receive earnings</li>
      <li><strong>Create Your First Listing</strong> - Share a fashion find from your local boutiques</li>
      <li><strong>Build Your Following</strong> - Share your profile to attract buyers</li>
    </ol>

    <h3>Tips for Success</h3>
    <ul>
      <li>High-quality photos sell - take clear, well-lit images</li>
      <li>Be accurate with descriptions - happy buyers leave good reviews</li>
      <li>Ship within 48 hours - maintain your curator health score</li>
      <li>Engage with your followers - they'll keep coming back</li>
    </ul>

    <p>We're excited to see what amazing pieces you'll curate!</p>

    <p>Happy hunting,<br>The Nafisa's Closet Team</p>

    <hr>
    <p style="color: #666; font-size: 12px;">
      Questions? Reply to this email and we'll help you out.
    </p>
  `;

  const text = `
Welcome to Nafisa's Closet!

Hi ${user.name || 'there'},

Congratulations! You're now a curator on Nafisa's Closet. You can start posting your fashion finds and earning from your unique style.

Getting Started:
1. Complete Stripe Onboarding - Set up your payout account to receive earnings
2. Create Your First Listing - Share a fashion find from your local boutiques
3. Build Your Following - Share your profile to attract buyers

Tips for Success:
- High-quality photos sell - take clear, well-lit images
- Be accurate with descriptions - happy buyers leave good reviews
- Ship within 48 hours - maintain your curator health score
- Engage with your followers - they'll keep coming back

We're excited to see what amazing pieces you'll curate!

Happy hunting,
The Nafisa's Closet Team
  `;

  return sendEmail({
    to: user.email,
    subject,
    html,
    text,
  });
}

/**
 * Send transaction receipt to buyer
 */
export async function sendTransactionReceipt(user, transaction, listing) {
  const subject = `Your Order Confirmation - ${listing.title}`;

  const html = `
    <h2>Order Confirmation</h2>
    <p>Hi ${user.name || 'there'},</p>

    <p>Thank you for your purchase! Here are your order details:</p>

    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0;">${listing.title}</h3>
      ${listing.brand ? `<p><strong>Brand:</strong> ${listing.brand}</p>` : ''}
      ${listing.size ? `<p><strong>Size:</strong> ${listing.size}</p>` : ''}
      <p><strong>Order Total:</strong> $${transaction.final_price}</p>
      <p><strong>Order ID:</strong> #${transaction.id}</p>
    </div>

    <h3>What's Next?</h3>
    <ol>
      <li>The curator will purchase your item from the boutique</li>
      <li>You'll receive tracking info once it ships</li>
      <li>Confirm delivery when your item arrives</li>
    </ol>

    <p>Track your order in the app under Activity > My Orders.</p>

    <p>Happy shopping,<br>The Nafisa's Closet Team</p>
  `;

  const text = `
Order Confirmation

Hi ${user.name || 'there'},

Thank you for your purchase! Here are your order details:

Item: ${listing.title}
${listing.brand ? `Brand: ${listing.brand}` : ''}
${listing.size ? `Size: ${listing.size}` : ''}
Order Total: $${transaction.final_price}
Order ID: #${transaction.id}

What's Next?
1. The curator will purchase your item from the boutique
2. You'll receive tracking info once it ships
3. Confirm delivery when your item arrives

Track your order in the app under Activity > My Orders.

Happy shopping,
The Nafisa's Closet Team
  `;

  return sendEmail({
    to: user.email,
    subject,
    html,
    text,
  });
}
