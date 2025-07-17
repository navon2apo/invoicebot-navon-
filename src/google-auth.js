import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import http from 'http';

// Define the scopes required for our application
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send'
];

// Path to the credentials file
const CREDENTIALS_PATH = path.join(process.cwd(), 'google-credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

// OAuth settings
const OAUTH_PORT = 3000;
const REDIRECT_URI = `http://localhost:${OAUTH_PORT}/callback`;

/**
 * Creates a new OAuth2 client with the credentials provided.
 * @returns {google.auth.OAuth2} The new OAuth2 client.
 */
function getOAuth2Client() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
  return oAuth2Client;
}

/**
 * Enhanced authentication flow with local HTTP server
 * @returns {Promise<{success: boolean, message: string, tokens?: any}>}
 */
export async function authenticateWithServer() {
  return new Promise((resolve, reject) => {
    const oAuth2Client = getOAuth2Client();
    
    // Generate auth URL
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent' // Force consent screen to get refresh token
    });

    // Create temporary HTTP server
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://localhost:${OAUTH_PORT}`);
        
        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');
          
          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html dir="rtl">
                <head><title>שגיאה באימות</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                  <h1>❌ שגיאה באימות</h1>
                  <p>שגיאה: ${error}</p>
                  <p>אתה יכול לסגור את החלון הזה</p>
                </body>
              </html>
            `);
            server.close();
            resolve({ success: false, message: `שגיאה באימות: ${error}` });
            return;
          }
          
          if (code) {
            try {
              // Exchange code for tokens
              const { tokens } = await oAuth2Client.getToken(code);
              oAuth2Client.setCredentials(tokens);
              
              // Store tokens
              fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
              console.log('Tokens stored successfully');
              
              // Send success response
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <html dir="rtl">
                  <head><title>אימות הושלם</title></head>
                  <body style="font-family: Arial; text-align: center; padding: 50px; background: #f0f8ff;">
                    <h1>✅ אימות הושלם בהצלחה!</h1>
                    <p>אתה יכול לסגור את החלון הזה ולחזור לאפליקציה</p>
                    <script>
                      setTimeout(() => window.close(), 3000);
                    </script>
                  </body>
                </html>
              `);
              
              server.close();
              resolve({ 
                success: true, 
                message: 'אימות הושלם בהצלחה!',
                tokens 
              });
              
            } catch (tokenError) {
              console.error('Error getting tokens:', tokenError);
              res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <html dir="rtl">
                  <head><title>שגיאה</title></head>
                  <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>❌ שגיאה בקבלת הטוקן</h1>
                    <p>אתה יכול לסגור את החלון הזה ולנסות שוב</p>
                  </body>
                </html>
              `);
              server.close();
              resolve({ success: false, message: 'שגיאה בקבלת הטוקן' });
            }
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html dir="rtl">
                <head><title>שגיאה</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                  <h1>❌ לא התקבל קוד אימות</h1>
                  <p>אתה יכול לסגור את החלון הזה ולנסות שוב</p>
                </body>
              </html>
            `);
            server.close();
            resolve({ success: false, message: 'לא התקבל קוד אימות' });
          }
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
        server.close();
        resolve({ success: false, message: 'שגיאת שרת' });
      }
    });

    // Start server
    server.listen(OAUTH_PORT, () => {
      console.log(`OAuth server listening on port ${OAUTH_PORT}`);
      
      // Return auth URL for opening browser
      resolve({ 
        success: false, 
        authUrl,
        message: 'פותח דפדפן לאימות...',
        serverStarted: true
      });
    });

    server.on('error', (error) => {
      console.error('Server error:', error);
      if (error.code === 'EADDRINUSE') {
        resolve({ 
          success: false, 
          message: `פורט ${OAUTH_PORT} תפוס. אנא סגור אפליקציות אחרות ונסה שוב.` 
        });
      } else {
        resolve({ success: false, message: 'שגיאה בהפעלת השרת' });
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      resolve({ success: false, message: 'תם הזמן הקצוב לאימות' });
    }, 5 * 60 * 1000);
  });
}

/**
 * Load or request authorization to call APIs.
 */
export async function authorize() {
  const oAuth2Client = getOAuth2Client();
  
  // Check if we have previously stored a token.
  try {
    const token = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  } catch (err) {
    // Token doesn't exist, need to get authorization
    throw new Error('No valid token found. Need to authorize first.');
  }
}

/**
 * Lists Gmail messages with invoice/receipt keywords
 */
export async function searchInvoices(auth, query = 'חשבונית OR קבלה OR invoice OR receipt') {
  const gmail = google.gmail({ version: 'v1', auth });
  
  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50
    });
    
    return response.data.messages || [];
  } catch (error) {
    console.error('Error searching emails:', error);
    throw error;
  }
}

/**
 * Gets email details
 */
export async function getEmailDetails(auth, messageId) {
  const gmail = google.gmail({ version: 'v1', auth });
  
  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    
    const message = response.data;
    const headers = message.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from = headers.find(h => h.name === 'From')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value || '';
    
    // Extract attachments info
    const attachments = [];
    
    function extractAttachments(parts) {
      if (!parts) return;
      
      for (const part of parts) {
        if (part.filename && part.body.attachmentId) {
          attachments.push({
            id: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size
          });
        }
        
        if (part.parts) {
          extractAttachments(part.parts);
        }
      }
    }
    
    extractAttachments(message.payload.parts);
    
    return {
      id: messageId,
      subject,
      from,
      date,
      attachments,
      internalDate: message.internalDate,
      rawData: message
    };
    
  } catch (error) {
    console.error('Error getting email details:', error);
    throw error;
  }
}

// Download attachment by ID
export async function getAttachment(auth, messageId, attachmentId) {
  const gmail = google.gmail({ version: 'v1', auth });
  
  try {
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId
    });
    
    // Convert base64 data to buffer
    const data = attachment.data.data;
    const buffer = Buffer.from(data, 'base64');
    
    return buffer;
    
  } catch (error) {
    console.error('Error downloading attachment:', error);
    throw error;
  }
}

/**
 * Check if we have valid authentication tokens
 */
export async function checkAuthStatus() {
  try {
    const auth = await authorize();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Search for invoice emails (wrapper for searchInvoices)
 */
export async function searchInvoiceEmails() {
  try {
    const auth = await authorize();
    return await searchInvoices(auth);
  } catch (error) {
    console.error('Error searching invoice emails:', error);
    throw error;
  }
} 

/**
 * Main authentication function with improved flow
 */
export async function authenticate() {
  try {
    // First check if we already have a valid token
    try {
      const auth = await authorize();
      return { success: true, message: 'כבר מחובר' };
    } catch (error) {
      // Token doesn't exist or is invalid, proceed with new authentication
    }
    
    // Use the new server-based authentication
    return await authenticateWithServer();
    
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Enhanced Gmail search with date filtering
 * @param {Object} auth - The authenticated client
 * @param {string} query - Search query
 * @param {string} startDate - Start date in YYYY/MM/DD format
 * @param {string} endDate - End date in YYYY/MM/DD format
 * @param {number} maxResults - Maximum number of results
 */
export async function searchInvoicesWithDateFilter(auth, options = {}) {
  const {
    query = 'חשבונית OR קבלה OR invoice OR receipt',
    startDate = null,
    endDate = null,
    maxResults = 100
  } = options;

  const gmail = google.gmail({ version: 'v1', auth });
  
  try {
    // Build enhanced query with date filters
    let enhancedQuery = query;
    
    if (startDate) {
      enhancedQuery += ` after:${startDate}`;
    }
    
    if (endDate) {
      enhancedQuery += ` before:${endDate}`;
    }
    
    console.log('Searching with query:', enhancedQuery);
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: enhancedQuery,
      maxResults: maxResults
    });
    
    return response.data.messages || [];
  } catch (error) {
    console.error('Error searching emails:', error);
    throw error;
  }
}

/**
 * Get default date range (last 3 months)
 */
export function getDefaultDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);
  
  return {
    startDate: formatDateForGmail(startDate),
    endDate: formatDateForGmail(endDate)
  };
}

/**
 * Format date for Gmail API (YYYY/MM/DD)
 */
export function formatDateForGmail(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * Gets and stores new token after prompting for user authorization (legacy support)
 * @param {string} code The authorization code.
 */
export async function getAccessToken(code) {
  const oAuth2Client = getOAuth2Client();
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    
    // Store the token to disk for later program executions
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log('Token stored to', TOKEN_PATH);
    return tokens;
  } catch (error) {
    console.error('Error retrieving access token', error);
    throw error;
  }
}

/**
 * Generates a URL that asks for user consent to access their Gmail account (legacy support)
 */
export function getAuthUrl() {
  const oAuth2Client = getOAuth2Client();
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Generated Auth URL:', authUrl);
  return authUrl;
} 