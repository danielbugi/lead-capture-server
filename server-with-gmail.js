// server-simple.js with Gmail email integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: [
      'https://elz.vercel.app',
      'http://localhost:3000',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Gmail transporter setup
let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  // Verify connection configuration
  transporter.verify(function (error, success) {
    if (error) {
      console.error('❌ Gmail configuration error:', error.message);
      console.log('Email notifications will NOT be sent.');
      transporter = null; // Disable email if verification fails
    } else {
      console.log('✅ Gmail server is ready to send notifications');
    }
  });
} else {
  console.log('❌ Gmail credentials not found. Email notifications disabled.');
}

// Google Sheets setup
async function getGoogleSheetsAuth() {
  try {
    // Get the private key from environment variable
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    // If the key has \n escape sequences, replace them with actual newlines
    if (privateKey && privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return auth;
  } catch (error) {
    console.error('Error in Google Sheets authentication setup:', error);
    throw error;
  }
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

// Email notification using Gmail
async function sendNotificationEmail(data) {
  try {
    // Check if Gmail transporter is configured
    if (!transporter) {
      console.log(
        'Gmail transporter not configured. Skipping email notification.'
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
            background-color: #f9f9f9;
          }
          .container {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background-color: #f07e26;
            color: white;
            padding: 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content {
            padding: 30px;
          }
          .lead-info {
            margin-bottom: 25px;
          }
          .info-row {
            padding: 10px 0;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: bold;
            color: #f07e26;
            min-width: 100px;
          }
          .value {
            flex: 1;
            text-align: left;
          }
          .timestamp {
            color: #666;
            font-size: 0.9em;
            text-align: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eee;
          }
          .footer {
            background-color: #f5f5f5;
            padding: 15px;
            text-align: center;
            font-size: 0.8em;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 ליד חדש מדף הנחיתה!</h1>
          </div>
          <div class="content">
            <div class="lead-info">
              <div class="info-row">
                <span class="label">שם:</span>
                <span class="value">${data.name}</span>
              </div>
              <div class="info-row">
                <span class="label">אימייל:</span>
                <span class="value">${data.email}</span>
              </div>
              <div class="info-row">
                <span class="label">טלפון:</span>
                <span class="value">${data.phone}</span>
              </div>
              <div class="info-row">
                <span class="label">אישור לווטסאפ:</span>
                <span class="value">${data.whatsapp ? '✅ כן' : '❌ לא'}</span>
              </div>
              <div class="info-row">
                <span class="label">מקור:</span>
                <span class="value">${data.source || 'דף נחיתה'}</span>
              </div>
            </div>
            <div class="timestamp">
              📅 התקבל בתאריך: ${formattedDate}
            </div>
          </div>
          <div class="footer">
            מערכת ניהול לידים - אלרן זורמן
          </div>
        </div>
      </body>
      </html>
    `;

    console.log('Sending email notification via Gmail...');

    const mailOptions = {
      from: `"Elran Lead Capture" <${process.env.EMAIL_USER}>`,
      to: process.env.NOTIFICATION_EMAIL,
      replyTo: data.email, // Allow easy reply to the lead
      subject: `🎯 ליד חדש: ${data.name} - ${data.phone}`,
      html: htmlContent,
      text: `ליד חדש מדף הנחיתה!\n\nשם: ${data.name}\nאימייל: ${data.email}\nטלפון: ${data.phone}\nווטסאפ: ${data.whatsapp ? 'כן' : 'לא'}\nמקור: ${data.source || 'דף נחיתה'}\n\nהתקבל בתאריך: ${formattedDate}`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully via Gmail:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email via Gmail:', error);
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
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    services: {
      googleSheets: !!process.env.GOOGLE_CLIENT_EMAIL,
      email: !!transporter,
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Ready to receive form submissions from ${process.env.FRONTEND_URL || 'http://localhost:3000'}`
  );

  // Check if Gmail is configured
  if (transporter) {
    console.log(
      'Gmail email service is configured and ready to send notifications'
    );
    console.log(
      'Notification emails will be sent to:',
      process.env.NOTIFICATION_EMAIL
    );
  } else {
    console.log(
      'Gmail email service is NOT configured - email notifications are disabled'
    );
    console.log(
      'To enable email notifications, add EMAIL_USER and EMAIL_PASS to your .env file'
    );
  }
});
