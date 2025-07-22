const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;

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

  // ננסה תמיד לטעון את ה-dev server אם הוא זמין
  const devUrl = 'http://localhost:5174';
  const prodUrl = path.join(__dirname, 'dist/index.html');

  // נבדוק אם ה-dev server רץ
  const http = require('http');
  http.get(devUrl, (res) => {
    console.log('ELECTRON: טוען dev server:', devUrl);
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  }).on('error', () => {
    console.log('ELECTRON: dev server לא זמין, טוען build:', prodUrl);
    mainWindow.loadFile(prodUrl);
  });
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

ipcMain.handle('google-logout', async () => {
  try {
    if (!googleAuth) await loadGoogleAuth();
    const result = await googleAuth.logout();
    // איפוס session של Gmail ב-Electron
    const { session } = require('electron');
    await session.fromPartition('persist:gmail-session').clearStorageData();
    return result;
  } catch (error) {
    console.error('Error during logout:', error);
    return { success: false, message: 'שגיאה בהתנתקות: ' + error.message };
  }
});

ipcMain.handle('google-search-invoices', async () => {
  try {
    if (!googleAuth) await loadGoogleAuth();
    const auth = await googleAuth.authorize();
    const messages = await googleAuth.searchInvoices(auth);
    console.log('google-search-invoices: messages.length', messages.length);
    const emailPromises = messages.map(async (message) => {
      try {
        const email = await googleAuth.getEmailDetails(auth, message.id);
        console.log('google-search-invoices: email', {
          id: email.id,
          subject: email.subject,
          attachments: email.attachments
        });
        // אל תביא data, רק metadata
        return email;
      } catch (error) {
        console.error(`Error getting email details for ${message.id}:`, error);
        return null;
      }
    });
    const emails = await Promise.all(emailPromises);
    const validEmails = emails.filter(email => email !== null);
    console.log('google-search-invoices: validEmails.length', validEmails.length);
    return { success: true, emails: validEmails };
  } catch (error) {
    console.error('Error searching invoices:', error);
    return { success: false, error: error.message };
  }
});

// Endpoint: הורד קובץ לפי id (getAttachment)
ipcMain.handle('download-attachment', async (event, { emailId, attachmentId }) => {
  try {
    if (!googleAuth) await loadGoogleAuth();
    const auth = await googleAuth.authorize();
    const buffer = await googleAuth.getAttachment(auth, emailId, attachmentId);
    return { success: true, data: buffer.toString('base64') };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Endpoint: showSaveDialog ושמירה ל-fs
ipcMain.handle('save-file-dialog', async (event, { filename, dataBase64 }) => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      defaultPath: filename
    });
    if (canceled || !filePath) return { success: false, canceled: true };
    await fsp.writeFile(filePath, Buffer.from(dataBase64, 'base64'));
    return { success: true, filePath };
  } catch (error) {
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

// שמירת קבצים לתיקייה – שמור רק קבצים עם data
ipcMain.handle('save-attachments-to-folder', async (event, attachments, invoiceDate) => {
  try {
    // קביעת תיקיית יעד לפי חודש
    const dateObj = invoiceDate ? new Date(invoiceDate) : new Date();
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const folderPath = path.join(__dirname, 'invoices', `${year}-${month}`);
    await fsp.mkdir(folderPath, { recursive: true });

    const savedFiles = [];
    for (const att of attachments) {
      if (!att.data) {
        console.log('Skipping attachment with no data:', att.filename);
        continue;
      }
      let baseName = att.filename.replace(/[^a-zA-Z0-9א-ת_.-]/g, '_');
      let filePath = path.join(folderPath, baseName);
      let counter = 1;
      // טיפול בשמות כפולים
      while (fs.existsSync(filePath)) {
        const ext = path.extname(baseName);
        const name = path.basename(baseName, ext);
        filePath = path.join(folderPath, `${name}_${counter}${ext}`);
        counter++;
      }
      await fsp.writeFile(filePath, Buffer.from(att.data, 'base64'));
      savedFiles.push(filePath);
      console.log('Saved file:', filePath);
    }
    return { success: true, savedFiles, folderPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('capture-mail-screenshot', async (event, { mailHtml }) => {
  try {
    // 1. צור חלון נסתר ב‑offscreen mode
    const win = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: true }
    });
    // 2. טען את ה‑HTML של גוף המייל בתוך data URL
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(mailHtml)}`);
    // 3. חכה לטעינה מלאה, צלם את המסך ושמור PNG
    await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
    const image = await win.webContents.capturePage();
    const dateFolder = path.join(app.getPath('documents'), new Date().toISOString().slice(0,10));
    if (!fs.existsSync(dateFolder)) fs.mkdirSync(dateFolder);
    // 4. שיח שמירת קובץ
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: path.join(dateFolder, 'invoice.png')
    });
    if (filePath && !canceled) {
      fs.writeFileSync(filePath, image.toPNG());
      win.destroy();
      return { success: true, filePath };
    } else {
      win.destroy();
      return { success: false, canceled: true };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- Gmail Preview & Screenshot via BrowserWindow ---
const GMAIL_PARTITION = 'persist:gmail-session';
const GMAIL_PREVIEW_PRELOAD = path.join(__dirname, 'gmail-preview-preload.js');

// Map to store preview window info by id
const previewWindowInfo = new Map();

ipcMain.handle('open-gmail-preview', async (event, { rfc822msgid, messageId, subject, from }) => {
  try {
    const mainWindow = BrowserWindow.getFocusedWindow();
    const previewWin = new BrowserWindow({
      parent: mainWindow,
      modal: true,
      width: 1200,  // רוחב גדול יותר לצילום טוב
      height: 900,  // גובה גדול יותר לצילום טוב
      minWidth: 1000,
      minHeight: 700,
      webPreferences: {
        partition: GMAIL_PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
        preload: GMAIL_PREVIEW_PRELOAD,
        zoomFactor: 1.0  // וידא זום תקין
      }
    });
    
    // שמור גם subject וגם from (השולח) לפי window id
    previewWindowInfo.set(previewWin.id, { 
      subject, 
      from,
      messageId,
      rfc822msgid 
    });
    
    previewWin.on('closed', () => {
      previewWindowInfo.delete(previewWin.id);
      event.sender.send('gmail-preview-closed');
    });
    
    // תיקון URL של Gmail - השתמש תמיד ב-rfc822msgid
    let gmailUrl;
    if (rfc822msgid) {
      // הדרך הנכונה לחפש מייל ספציפי ב-Gmail
      gmailUrl = `https://mail.google.com/mail/u/0/#search/rfc822msgid:${rfc822msgid}`;
      console.log('Gmail URL with rfc822msgid:', gmailUrl);
    } else if (messageId) {
      // אם אין rfc822msgid, נסה חיפוש כללי
      gmailUrl = `https://mail.google.com/mail/u/0/#search/${messageId}`;
      console.log('Gmail URL with messageId search:', gmailUrl);
    } else {
      throw new Error('חסר messageId או rfc822msgid');
    }
    
    await previewWin.loadURL(gmailUrl);
    
    // המתן יותר זמן ואז נסה לפתוח את המייל אוטומטית
    setTimeout(() => {
      previewWin.webContents.executeJavaScript(`
        console.log('מנסה פתיחה אוטומטית מtain process...');
        
        // וודא שהדף נטען מלא
        if (document.readyState !== 'complete') {
          window.addEventListener('load', () => {
            setTimeout(tryAutoOpen, 2000);
          });
        } else {
          setTimeout(tryAutoOpen, 2000);
        }
        
        function tryAutoOpen() {
          console.log('מבצע פתיחה אוטומטית...');
          
          // חפש אלמנטים של מיילים
          const selectors = [
            'tr[role="row"]:not([aria-selected="true"])',
            '[role="listitem"]:not([aria-selected="true"])',
            'div[data-legacy-thread-id]',
            '.zA:not(.yW)'
          ];
          
          for (let selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              console.log('מצא אלמנטים עם selector:', selector, elements.length);
              elements[0].click();
              
              // המתן ונסה להרחיב
              setTimeout(() => {
                expandEmailContent();
              }, 3000);
              break;
            }
          }
        }
        
        function expandEmailContent() {
          console.log('מנסה להרחיב תוכן המייל...');
          
          // כפתורי הרחבה
          const expandSelectors = [
            '[aria-label*="Show"]',
            '[aria-label*="More"]', 
            '[title*="Show"]',
            '.aaq',
            '.amn',
            '.bog'
          ];
          
          expandSelectors.forEach(selector => {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(btn => {
              if (btn && btn.offsetParent !== null) {
                btn.click();
                console.log('לחץ על כפתור הרחבה:', selector);
              }
            });
          });
          
          // גלול למעלה
          setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 1000);
        }
      `).catch(err => console.log('JavaScript execution failed:', err));
    }, 4000); // המתן 4 שניות במקום 3
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('capture-gmail-mailbody', async (event, { messageId, rfc822msgid, defaultFilename }) => {
  try {
    // מצא חלון preview פתוח
    const previewWin = BrowserWindow.getAllWindows().find(w => w.getTitle().includes('Gmail'));
    if (!previewWin) return { success: false, error: 'חלון Gmail לא פתוח' };
    // בקש את ה-rect של גוף המייל
    previewWin.webContents.send('request-capture-mail-body');
    const rect = await new Promise(resolve => {
      ipcMain.once('mail-body-rect', (evt, data) => resolve(data));
      setTimeout(() => resolve(null), 5000); // הגנה מקרה תקיעה
    });
    if (!rect) return { success: false, error: 'לא נמצא גוף מייל' };
    const image = await previewWin.webContents.capturePage(rect);
    // שמור PNG
    const dateFolder = path.join(app.getPath('documents'), new Date().toISOString().slice(0,10));
    if (!fs.existsSync(dateFolder)) fs.mkdirSync(dateFolder);
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: path.join(dateFolder, (defaultFilename || messageId || rfc822msgid) + '-mailbody.png')
    });
    if (filePath && !canceled) {
      fs.writeFileSync(filePath, image.toPNG());
      return { success: true, filePath };
    } else {
      return { success: false, canceled: true };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('capture-gmail-screenshot', async (event, { rfc822msgid, defaultFilename }) => {
  try {
    const gmailUrl = `https://mail.google.com/mail/u/0/#search/rfc822msgid:${rfc822msgid}`;
    const captureWin = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
        partition: GMAIL_PARTITION,
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    await captureWin.loadURL(gmailUrl);
    await new Promise(resolve => captureWin.webContents.once('did-finish-load', resolve));
    // המתן עוד קצת לטעינה מלאה (תמונות, CSS)
    await new Promise(res => setTimeout(res, 2000));
    const image = await captureWin.webContents.capturePage();
    captureWin.destroy();
    // דיאלוג שמירה
    const dateFolder = path.join(app.getPath('documents'), new Date().toISOString().slice(0,10));
    if (!fs.existsSync(dateFolder)) fs.mkdirSync(dateFolder);
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: path.join(dateFolder, (defaultFilename || rfc822msgid) + '.png')
    });
    if (filePath && !canceled) {
      fs.writeFileSync(filePath, image.toPNG());
      return { success: true, filePath };
    } else {
      return { success: false, canceled: true };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Listener for capture from preview window
ipcMain.on('capture-mail-body-from-preview', async (event) => {
  try {
    const previewWin = BrowserWindow.fromWebContents(event.sender);
    if (!previewWin) return;
    
    // בקש את ה-rect של גוף המייל
    previewWin.webContents.send('request-capture-mail-body');
    const rect = await new Promise(resolve => {
      ipcMain.once('mail-body-rect', (evt, data) => resolve(data));
      setTimeout(() => resolve(null), 5000);
    });
    
    if (!rect) {
      previewWin.webContents.send('mailbody-capture-result', { error: 'לא נמצא גוף מייל' });
      return;
    }
    
    const image = await previewWin.webContents.capturePage(rect);
    
    // קבע שם קובץ מושכל יותר: from (השולח) הוא העדיפות הראשונהimage.png
    const info = previewWindowInfo.get(previewWin.id) || {};
    let baseName = '';
    
    // עדיפות לשם השולח
    if (info.from && typeof info.from === 'string' && info.from.trim()) {
      // נקה את השם מכתובת מייל ותווים מיותרים
      let fromName = info.from;
      // אם יש <...> בכתובת, קח רק את החלק לפני
      if (fromName.includes('<')) {
        fromName = fromName.split('<')[0].trim();
      }
      // אם יש @, קח רק את החלק לפני
      if (fromName.includes('@')) {
        fromName = fromName.split('@')[0].trim();
      }
      // נקה תווים לא חוקיים
      baseName = fromName.replace(/[^\w\d\u0590-\u05FF\s\-\.]/g, '').replace(/\s+/g, '_').slice(0, 30);
    } else if (info.subject && typeof info.subject === 'string' && info.subject.trim()) {
      baseName = info.subject.replace(/[^\w\d\u0590-\u05FF\s\-\.]/g, '').replace(/\s+/g, '_').slice(0, 30);
    } else {
      baseName = 'gmail-capture';
    }
    
    const dateStr = new Date().toISOString().slice(0,10);
    const timeStr = new Date().toTimeString().slice(0,5).replace(':', '');
    const filename = `${dateStr}_${timeStr}_${baseName}.png`;
    
    console.log('צילום מג׳ימייל: filename:', filename, 'windowId:', previewWin.id, 'info:', info);
    
    // שמור ברירת מחדל בתיקיית המסמכים עם תת-תיקייה לפי תאריך
    const dateFolder = path.join(app.getPath('documents'), 'InvoiceBot', dateStr);
    await fsp.mkdir(dateFolder, { recursive: true });
    
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: path.join(dateFolder, filename)
    });
    
    if (filePath && !canceled) {
      fs.writeFileSync(filePath, image.toPNG());
      previewWin.webContents.send('mailbody-capture-result', { filePath });
    } else {
      previewWin.webContents.send('mailbody-capture-result', { error: 'שמירה בוטלה' });
    }
  } catch (error) {
    const previewWin = BrowserWindow.fromWebContents(event.sender);
    if (previewWin) previewWin.webContents.send('mailbody-capture-result', { error: error.message });
  }
});

// פתח תיקייה ב-explorer
ipcMain.on('open-external-folder', (event, filePath) => {
  if (filePath) {
    const folder = path.dirname(filePath);
    shell.openPath(folder);
  }
});

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