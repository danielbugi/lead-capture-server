// server.js
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
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['POST'],
    credentials: true,
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

  const resource = {
    values,
  };

  return sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    resource,
  });
}

// Email setup
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendNotificationEmail(data) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.NOTIFICATION_EMAIL,
    subject: 'New Lead Captured!',
    html: `
      <h1>New Lead from Landing Page</h1>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Phone:</strong> ${data.phone}</p>
      <p><strong>Whatsapp Consent:</strong> ${data.whatsapp ? 'Yes' : 'No'}</p>
      <p><strong>Source:</strong> ${data.source || 'Landing Page'}</p>
      <p><strong>Time:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
    `,
  };

  return transporter.sendMail(mailOptions);
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

    // Save to Google Sheets
    await appendToSheet(formData);

    // Send notification email
    await sendNotificationEmail(formData);

    return res
      .status(200)
      .json({ success: true, message: 'Form submitted successfully' });
  } catch (error) {
    console.error('Error processing form submission:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Ready to receive form submissions from ${
      process.env.FRONTEND_URL || 'http://localhost:3000'
    }`
  );
});
