const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// Import Google Auth functions (will need to convert to CommonJS)
let googleAuth;

// Additional imports for invoice processing
let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (error) {
  console.warn('pdf-parse not available, PDF processing will be simulated');
}

async function loadGoogleAuth() {
  try {
    const module = await import('./src/google-auth.js');
    googleAuth = module;
  } catch (error) {
    console.error('Failed to load Google Auth module:', error);
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

// IPC Handlers for Google Auth
ipcMain.handle('google-authenticate', async () => {
  try {
    if (!googleAuth) await loadGoogleAuth();
    
    const result = await googleAuth.authenticate();
    
    if (result.success) {
      return { success: true, message: result.message };
    } else if (result.authUrl && result.serverStarted) {
      // New flow: Server is running, open browser
      await shell.openExternal(result.authUrl);
      return { 
        success: false, 
        message: 'דפדפן נפתח - אימות מתבצע אוטומטיה...',
        needsWait: true,
        modernFlow: true
      };
    } else {
      // Fallback to old flow if server failed
      if (result.authUrl) {
        await shell.openExternal(result.authUrl);
      }
      return { 
        success: false, 
        message: result.message || 'דפדפן נפתח - בצע אימות ולאחר מכן הכנס את הקוד באפליקציה',
        needsAuthCode: true,
        modernFlow: false
      };
    }
  } catch (error) {
    console.error('Error during authentication:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('google-check-auth', async () => {
  try {
    if (!googleAuth) await loadGoogleAuth();
    const isValid = await googleAuth.checkAuthStatus();
    return { isValid };
  } catch (error) {
    console.error('Error checking auth:', error);
    return { isValid: false, error: error.message };
  }
});

ipcMain.handle('google-submit-auth-code', async (event, code) => {
  try {
    if (!googleAuth) await loadGoogleAuth();
    await googleAuth.getAccessToken(code);
    return { success: true, message: 'אימות הושלם בהצלחה!' };
  } catch (error) {
    console.error('Error submitting auth code:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('google-search-invoices', async () => {
  try {
    if (!googleAuth) await loadGoogleAuth();
    const auth = await googleAuth.authorize();
    const messages = await googleAuth.searchInvoices(auth);
    
    const emailPromises = messages.map(async (message) => {
      try {
        return await googleAuth.getEmailDetails(auth, message.id);
      } catch (error) {
        console.error(`Error getting email details for ${message.id}:`, error);
        return null;
      }
    });
    
    const emails = await Promise.all(emailPromises);
    const validEmails = emails.filter(email => email !== null);
    
    return { success: true, emails: validEmails };
  } catch (error) {
    console.error('Error searching invoices:', error);
    return { success: false, error: error.message };
  }
});

// New handler for date-filtered search
ipcMain.handle('google-search-invoices-with-dates', async (event, startDate, endDate) => {
  try {
    if (!googleAuth) await loadGoogleAuth();
    const messages = await googleAuth.searchInvoiceEmailsWithDates(startDate, endDate);
    
    const emailPromises = messages.map(async (message) => {
      try {
        const auth = await googleAuth.authorize();
        return await googleAuth.getEmailDetails(auth, message.id);
      } catch (error) {
        console.error(`Error getting email details for ${message.id}:`, error);
        return null;
      }
    });
    
    const emails = await Promise.all(emailPromises);
    const validEmails = emails.filter(email => email !== null);
    
    return { success: true, emails: validEmails };
  } catch (error) {
    console.error('Error searching invoices with dates:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('google-get-email-details', async (event, messageId) => {
  try {
    if (!googleAuth) await loadGoogleAuth();
    const auth = await googleAuth.authorize();
    return await googleAuth.getEmailDetails(auth, messageId);
  } catch (error) {
    console.error('Error getting email details:', error);
    throw error;
  }
});

ipcMain.handle('shell-open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external URL:', error);
    throw error;
  }
});

// Invoice processing handlers
ipcMain.handle('process-invoice-attachments', async (event, emailId) => {
  try {
    if (!googleAuth) await loadGoogleAuth();
    const auth = await googleAuth.authorize();
    
    // Get email details with attachments
    const emailDetails = await googleAuth.getEmailDetails(auth, emailId);
    
    const processedAttachments = [];
    
    for (const attachment of emailDetails.attachments || []) {
      try {
        // Download attachment
        const attachmentData = await googleAuth.getAttachment(auth, emailId, attachment.id);
        
        // Process attachment based on type
        const processedData = await processAttachment(attachment, attachmentData);
        processedAttachments.push(processedData);
        
      } catch (error) {
        console.error(`Error processing attachment ${attachment.filename}:`, error);
        processedAttachments.push({
          filename: attachment.filename,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      emailId,
      processedAttachments
    };
    
  } catch (error) {
    console.error('Error processing invoice attachments:', error);
    throw error;
  }
});

// Helper function to process individual attachments
async function processAttachment(attachment, buffer) {
  const { filename, mimeType } = attachment;
  
  try {
    let extractedText = '';
    let processingMethod = '';
    
    if (mimeType === 'application/pdf') {
      extractedText = await extractTextFromPDF(buffer);
      processingMethod = 'PDF_EXTRACT';
    } else if (mimeType.startsWith('image/')) {
      extractedText = await extractTextFromImage(buffer);
      processingMethod = 'OCR';
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
    
    // Extract invoice data from text
    const invoiceData = await extractInvoiceData(extractedText);
    
    return {
      filename,
      mimeType,
      processingMethod,
      extractedText,
      invoiceData,
      success: true,
      processedAt: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      filename,
      mimeType,
      success: false,
      error: error.message
    };
  }
}

// PDF text extraction
async function extractTextFromPDF(buffer) {
  try {
    if (pdfParse) {
      const data = await pdfParse(buffer);
      return data.text;
    } else {
      // Simulated PDF processing for development
      console.log('Simulating PDF text extraction...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return `חשבונית דוגמה מ-PDF
      
חברה: דוגמה בע"מ
ח.פ: 123456789
כתובת: רחוב הדוגמה 123, תל אביב

לכבוד: לקוח יקר
תאריך: ${new Date().toLocaleDateString('he-IL')}
מספר חשבונית: INV-2024-001

פירוט:
שירות ייעוץ - 100 ש"ח
מע"מ 17% - 17 ש"ח
סה"כ לתשלום: 117 ש"ח`;
    }
  } catch (error) {
    throw new Error(`PDF processing failed: ${error.message}`);
  }
}

// OCR for images (placeholder - actual OCR will be done in renderer)
async function extractTextFromImage(buffer) {
  // Note: Tesseract.js doesn't work well in Node.js main process
  // We'll simulate this for now and implement actual OCR in renderer process
  console.log('Simulating OCR text extraction...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return `דוגמת טקסט מ-OCR
  
חברת הדוגמה בע"מ
ח.פ: 987654321

חשבונית מס' 12345
תאריך: ${new Date().toLocaleDateString('he-IL')}

שירותים שונים: 250 ש"ח
מע"מ: 42.5 ש"ח
סה"כ: 292.5 ש"ח`;
}

// Extract structured data from text
async function extractInvoiceData(text) {
  const invoiceData = {
    companyName: extractCompanyName(text),
    companyId: extractCompanyId(text),
    invoiceNumber: extractInvoiceNumber(text),
    date: extractDate(text),
    totalAmount: extractTotalAmount(text),
    taxAmount: extractTaxAmount(text),
    items: extractItems(text),
    customerInfo: extractCustomerInfo(text)
  };
  
  return invoiceData;
}

// Helper functions for data extraction
function extractCompanyName(text) {
  const patterns = [
    /(?:חברה|חברת|ח\.פ\.?|מ\.ח\.ח\.?|שם העסק)[:\s]+(.+?)(?:\n|ח\.פ|מ\.ח\.ח|$)/i,
    /^(.+?)(?:בע"מ|בע"מ|ושות'|ושותפים|עמותה)/im,
    /(?:מאת|אצל|שם)[:\s]+(.+?)(?:\n|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function extractCompanyId(text) {
  const patterns = [
    /(?:ח\.פ\.?|ח"פ|מ\.ח\.ח\.?|עוסק מורשה)[:\s#]*(\d{9})/i,
    /(?:company|registration|tax)[:\s]*(\d{9})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

function extractInvoiceNumber(text) {
  const patterns = [
    /(?:חשבונית|מספר חשבונית|invoice|inv)[:\s#]*([A-Z0-9\-_]+)/i,
    /(?:מס'|מספר)[:\s]*(\d+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function extractDate(text) {
  const patterns = [
    /(?:תאריך|date)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/g
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      try {
        const date = new Date(match[1].replace(/[\.]/g, '/'));
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch (e) {
        continue;
      }
    }
  }
  return null;
}

function extractTotalAmount(text) {
  const patterns = [
    /(?:סה"כ|סכום כולל|total|סה״כ)[:\s]*([0-9,]+\.?\d*)[:\s]*(?:ש"ח|₪|ils|shekel)/i,
    /(?:לתשלום|לחיוב)[:\s]*([0-9,]+\.?\d*)[:\s]*(?:ש"ח|₪)/i,
    /([0-9,]+\.?\d*)[:\s]*(?:ש"ח|₪)(?:\s*$|\s*\n)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(amount)) {
        return amount;
      }
    }
  }
  return null;
}

function extractTaxAmount(text) {
  const patterns = [
    /(?:מע"מ|מע״מ|vat|tax)[:\s]*([0-9,]+\.?\d*)[:\s]*(?:ש"ח|₪|%)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(amount)) {
        return amount;
      }
    }
  }
  return null;
}

function extractItems(text) {
  const items = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    const itemMatch = line.match(/(.+?)\s+(\d+\.?\d*)\s*(?:ש"ח|₪)/);
    if (itemMatch) {
      items.push({
        description: itemMatch[1].trim(),
        amount: parseFloat(itemMatch[2])
      });
    }
  }
  
  return items;
}

function extractCustomerInfo(text) {
  const customerInfo = {};
  
  const customerPatterns = [
    /(?:לכבוד|לקוח|customer)[:\s]+(.+?)(?:\n|$)/i,
    /(?:כתובת|address)[:\s]+(.+?)(?:\n|$)/i
  ];

  for (const pattern of customerPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      customerInfo.name = match[1].trim();
      break;
    }
  }

  return customerInfo;
}

app.whenReady().then(() => {
  loadGoogleAuth();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 