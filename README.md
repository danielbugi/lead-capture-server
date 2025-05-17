# Lead Capture Server

A Node.js server for capturing lead information from a landing page, storing it in Google Sheets, and sending email notifications for new leads.

## Features

- ✅ Receive form submissions from a Next.js frontend
- ✅ Store lead data in Google Sheets
- ✅ Send email notifications using Resend
- ✅ Support for Hebrew/RTL in email templates
- ✅ Error handling and graceful fallbacks
- ✅ CORS protection for security

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Server](#running-the-server)
- [API Endpoints](#api-endpoints)
- [Email Notifications](#email-notifications)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Prerequisites

- Node.js (v14 or higher)
- Google account with access to Google Sheets
- Resend.com account for email notifications

## Installation

1. Clone this repository or download the files:

```bash
git clone https://github.com/yourusername/lead-capture-server.git
cd lead-capture-server
```

2. Install dependencies:

```bash
npm install
```

## Configuration

### 1. Google Sheets Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Sheets API" and enable it
4. Create a service account:

   - Go to "IAM & Admin" > "Service Accounts"
   - Click "CREATE SERVICE ACCOUNT"
   - Name: "lead-capture-service" (or any name you prefer)
   - Grant it the "Editor" role
   - Click "CREATE KEY" (JSON format)
   - Save the downloaded JSON file securely

5. Create a Google Sheet with the following structure:
   - Sheet name: "Leads"
   - Headers (Row 1): Timestamp, Name, Email, Phone, WhatsApp Consent, Source
   - Share this sheet with your service account email (found in the JSON file)

### 2. Resend Email Setup

1. Sign up at [Resend.com](https://resend.com/)
2. Create an API key
3. Copy the API key for your .env file

### 3. Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:3000

# Google Sheets API
GOOGLE_CLIENT_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
SPREADSHEET_ID=your-spreadsheet-id-from-url

# Resend Email Configuration
RESEND_API_KEY=re_123456789abcdef
RESEND_FROM_EMAIL=onboarding@resend.dev
NOTIFICATION_EMAIL=your-email@example.com
```

Notes:

- `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` come from your service account JSON
- `SPREADSHEET_ID` is the ID from your Google Sheet URL (between /d/ and /edit)
- `RESEND_API_KEY` is from your Resend dashboard
- `NOTIFICATION_EMAIL` is where you want to receive lead notifications

## Running the Server

### Development Mode

```bash
npm run dev
```

This uses nodemon to automatically restart the server when files change.

### Production Mode

```bash
npm start
```

The server will run on port 3001 by default (or the port specified in your .env file).

## API Endpoints

### POST /api/submit-form

Receives form data and processes it.

**Request Body:**

```json
{
  "name": "Client Name",
  "email": "client@example.com",
  "phone": "0501234567",
  "whatsapp": true,
  "source": "Landing Page",
  "timestamp": "2025-05-17T08:02:33.600Z"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Form submitted successfully",
  "details": {
    "sheetSuccess": true,
    "emailSuccess": true
  }
}
```

**Response (Error):**

```json
{
  "success": false,
  "message": "Error message here"
}
```

### GET /health

A simple health check endpoint to verify the server is running.

**Response:**

```json
{
  "status": "UP",
  "timestamp": "2025-05-17T08:02:33.600Z"
}
```

## Email Notifications

The server sends beautifully formatted email notifications for each new lead with the following features:

- Right-to-left (RTL) layout for Hebrew text
- Branded header with orange color
- Clear display of all lead information
- Responsive design for mobile viewing

## Frontend Integration

Update your Next.js form component to send data to this server:

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  setIsSubmitting(true);

  try {
    const response = await fetch('http://localhost:3001/api/submit-form', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        phone,
        whatsapp,
        source: 'Landing Page',
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    setSubmitted(true);
  } catch (error) {
    console.error('Error submitting form:', error);
    setError('שגיאה בשליחת הטופס. אנא נסה שוב.');
  } finally {
    setIsSubmitting(false);
  }
};
```

## Deployment

### Render.com (Recommended)

1. Sign up at [Render.com](https://render.com/)
2. Create a new Web Service
3. Connect your GitHub repository or upload files
4. Configure:
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node server-with-resend.js`
5. Add your environment variables
6. Deploy

### Railway.app

1. Sign up at [Railway.app](https://railway.app/)
2. Create a new project
3. Connect your GitHub repository or create a new service
4. Add your environment variables
5. Deploy

### Other Options

The server can also be deployed to:

- Heroku
- DigitalOcean App Platform
- Fly.io
- Any platform supporting Node.js applications

## Troubleshooting

### Google Sheets Issues

- **Error: "The caller does not have permission"**

  - Make sure you've shared your Google Sheet with the service account email
  - Check that the `SPREADSHEET_ID` in your .env file is correct
  - Verify that your Google Sheet has a tab named "Leads"

- **Error: "Invalid value at 'requests[0].add_sheet'"**
  - This means the "Leads" sheet already exists
  - Either rename your existing sheet or modify the code

### Email Issues

- **Error with Resend**
  - Verify your API key is correct
  - Check that the `NOTIFICATION_EMAIL` is valid
  - Review the Resend dashboard for any delivery issues

### CORS Issues

- **Error: "Access-Control-Allow-Origin"**
  - Make sure your `FRONTEND_URL` in .env matches your frontend's origin
  - Check that your frontend is using the correct API URL

## License

MIT
