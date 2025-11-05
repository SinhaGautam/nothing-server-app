import nodemailer from "nodemailer";
import { Product , OrderDetails} from "../schema";
import dotenv from 'dotenv';
import { logger } from "./logger";

dotenv.config();


// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD,
  },
});

export async function sendConfirmationEmail(
  customerEmail: string,
  customerName: string,
  product: string = "Nothing",
  order: string
): Promise<void> {
  logger.info(`Sending confirmation email to ${customerEmail}`);
  const subject = `Purchase Confirmation - You've Successfully Bought ${product}!`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Purchase Confirmation</title>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background-color: #000; color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .content { padding: 40px 30px; }
        .order-details { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .price { font-size: 24px; font-weight: 700; color: #000; }
        .disclaimer { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { background-color: #000; color: white; padding: 30px; text-align: center; }
        .btn { display: inline-block; background-color: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 25px; margin: 10px 0; }
        .checkmark { color: #28a745; font-size: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>buyNothing.com</h1>
          <p>Purchase Confirmation</p>
        </div>
        
        <div class="content">
          <h2>Congratulations, ${customerName}!</h2>
          <p>You have successfully purchased <strong>${product}</strong> from buyNothing.com.</p>
          
          <div class="order-details">
            <h3>Order Details</h3>
            <p><strong>Order Number:</strong> ${order}</p>
            <p><strong>Product:</strong> ${product}</p>
            
            
          </div>
          
          <div class="disclaimer">
            <h3>⚠️ Important Reminder</h3>
            <p>As clearly stated on our website, you will receive <strong>absolutely nothing</strong> in return for this purchase. This is not a mistake - you have successfully purchased the concept of nothing.</p>
            <ul>
              <li><span class="checkmark">✓</span> No physical items will be shipped</li>
              <li><span class="checkmark">✓</span> No digital downloads will be provided</li>
              <li><span class="checkmark">✓</span> You now own premium nothing</li>
              <li><span class="checkmark">✓</span> This purchase is final</li>
            </ul>
          </div>
          
          <p>Thank you for supporting the art of nothingness. Your purchase helps us continue our mission of providing the finest nothing to customers worldwide.</p>
          
          <p>If you have any questions about your nothing, please don't hesitate to contact us (though there's really nothing to ask about).</p>
          
          <p>Best regards,<br>
          The buyNothing.com Team</p>
        </div>
        
        <div class="footer">
          <p>&copy; 2024 buyNothing.com - All rights reserved. Nothing guaranteed.</p>
          <p>You purchased nothing, and that's exactly what you'll get.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.EMAIL_FROM || "noreply@buynothing.com",
    to: customerEmail,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Confirmation email sent to ${customerEmail}`);
  } catch (error) {
    logger.error("Failed to send confirmation email:", error);
    throw error;
  }
}

export async function sendContactEmail(
  customerEmail: string,
  customerName: string,
  message: string
): Promise<void> {
  logger.info(`Sending contact email from ${customerName} <${customerEmail}>`);
  const subject = `Contact message from ${customerName}`;
  const text = [
    `Name: ${customerName}`,
    `Email: ${customerEmail}`,
    '',
    'Message:',
    message,
    '',
    `Received at: ${new Date().toISOString()}`
  ].join('\n');

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@buynothing.com",
    to: process.env.SUPPORT_EMAIL || process.env.SMTP_USER || process.env.EMAIL_TO,
    subject,
    text,
    replyTo: customerEmail,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Contact email sent from ${customerName} <${customerEmail}> to ${mailOptions.to}`);
  } catch (err) {
    logger.error('Failed to send contact email', err);
    throw err;
  }
}
