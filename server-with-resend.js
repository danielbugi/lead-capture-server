// server-simple.js with Resend email integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Resend
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Google Sheets setup
async function getGoogleSheetsAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return auth;
}

async function appendToSheet(data) {
  try {
    console.log('Attempting to append data to Google Sheets...');

    const auth = await getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const range = 'Leads!A:F'; // Adjust based on your sheet structure

    const values = [
      [
        data.timestamp,
        data.name,
        data.email,
        data.phone,
        data.whatsapp ? 'Yes' : 'No',
        data.source,
      ],
    ];

    console.log('Appending values to sheet:', values);

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: {
        values,
      },
    });

    console.log('Data appended successfully to Google Sheets');
    return response;
  } catch (error) {
    console.error('Error in appendToSheet function:', error.message);
    throw error;
  }
}

// Email notification using Resend
async function sendNotificationEmail(data) {
  try {
    // Check if Resend is configured
    if (!resend) {
      console.log(
        'Resend API key not configured. Skipping email notification.'
      );
      return null;
    }

    // Format the date for display
    const formattedDate = new Date(data.timestamp).toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    // Create a more visually appealing HTML template
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ליד חדש התקבל!</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #f07e26;
            color: white;
            padding: 15px 20px;
            border-radius: 5px 5px 0 0;
          }
          .content {
            padding: 20px;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 5px 5px;
          }
          .lead-info {
            margin-bottom: 20px;
          }
          .label {
            font-weight: bold;
            margin-left: 10px;
          }
          .timestamp {
            color: #666;
            font-size: 0.9em;
            text-align: left;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ליד חדש מדף הנחיתה!</h1>
        </div>
        <div class="content">
          <div class="lead-info">
            <p><span class="label">שם:</span> ${data.name}</p>
            <p><span class="label">אימייל:</span> ${data.email}</p>
            <p><span class="label">טלפון:</span> ${data.phone}</p>
            <p><span class="label">אישור לווטסאפ:</span> ${data.whatsapp ? 'כן' : 'לא'}</p>
            <p><span class="label">מקור:</span> ${data.source || 'דף נחיתה'}</p>
          </div>
          <p class="timestamp">התקבל בתאריך: ${formattedDate}</p>
        </div>
      </body>
      </html>
    `;

    console.log('Sending email notification via Resend...');

    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: process.env.NOTIFICATION_EMAIL,
      subject: `ליד חדש: ${data.name} - ${data.phone}`,
      html: htmlContent,
    });

    console.log('Email sent successfully via Resend:', response.id);
    return response;
  } catch (error) {
    console.error('Error sending email via Resend:', error);
    // Don't throw the error, just log it so form submission continues
    return null;
  }
}

// Form submission endpoint
app.post('/api/submit-form', async (req, res) => {
  try {
    const formData = req.body;

    // Validate required fields
    if (!formData.name || !formData.email || !formData.phone) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing required fields' });
    }

    // Log the received data
    console.log('Received form submission:', formData);

    // Process in separate try/catch blocks so one failure doesn't affect the other
    let sheetSuccess = false;
    let emailSuccess = false;

    // Save to Google Sheets
    try {
      await appendToSheet(formData);
      sheetSuccess = true;
      console.log('Successfully saved to Google Sheets');
    } catch (sheetError) {
      console.error('Error saving to Google Sheets:', sheetError.message);
    }

    // Send email notification
    try {
      const emailResult = await sendNotificationEmail(formData);
      emailSuccess = !!emailResult;
      console.log(
        'Email notification result:',
        emailSuccess ? 'sent' : 'failed'
      );
    } catch (emailError) {
      console.error('Error sending email notification:', emailError.message);
    }

    // Determine overall success
    const overallSuccess = sheetSuccess; // Consider successful if at least Google Sheets worked

    if (overallSuccess) {
      return res.status(200).json({
        success: true,
        message: 'Form submitted successfully',
        details: {
          sheetSuccess,
          emailSuccess,
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to process form submission',
        details: {
          sheetSuccess,
          emailSuccess,
        },
      });
    }
  } catch (error) {
    console.error('Error processing form submission:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Ready to receive form submissions from ${process.env.FRONTEND_URL || 'http://localhost:3000'}`
  );

  // Check if Resend is configured
  if (resend) {
    console.log(
      'Resend email service is configured and ready to send notifications'
    );
    console.log(
      'Notification emails will be sent to:',
      process.env.NOTIFICATION_EMAIL
    );
  } else {
    console.log(
      'Resend email service is NOT configured - email notifications are disabled'
    );
    console.log(
      'To enable email notifications, add RESEND_API_KEY to your .env file'
    );
  }
});
