const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Test function
  testConnection: () => 'Electron is working!',
  
  // Google Auth functions
  authenticateGoogle: () => ipcRenderer.invoke('google-authenticate'),
  submitAuthCode: (code) => ipcRenderer.invoke('google-submit-auth-code', code),
  checkAuthToken: () => ipcRenderer.invoke('google-check-auth'),
  logoutGoogle: () => ipcRenderer.invoke('google-logout'),
  searchInvoiceEmails: () => ipcRenderer.invoke('google-search-invoices'),
  searchInvoiceEmailsWithDates: (startDate, endDate) => ipcRenderer.invoke('google-search-invoices-with-dates', startDate, endDate),
  getEmailDetails: (messageId) => ipcRenderer.invoke('google-get-email-details', messageId),
  
  // Shell operations
  openExternal: (url) => ipcRenderer.invoke('shell-open-external', url),
  
  // Invoice processing
  processInvoiceAttachments: (emailId) => ipcRenderer.invoke('process-invoice-attachments', emailId),
  saveAttachmentsToFolder: (attachments, invoiceDate) => ipcRenderer.invoke('save-attachments-to-folder', attachments, invoiceDate),
  
  // Email generation and export
  generateEmailSummary: (invoices) => ipcRenderer.invoke('generate-email-summary', invoices),
  exportToCSV: (invoices) => ipcRenderer.invoke('export-to-csv', invoices),
  downloadAttachment: (emailId, attachmentId) => ipcRenderer.invoke('download-attachment', { emailId, attachmentId }),
  saveFileDialog: (filename, dataBase64) => ipcRenderer.invoke('save-file-dialog', { filename, dataBase64 }),
  captureMailScreenshot: (mailHtml) => ipcRenderer.invoke('capture-mail-screenshot', { mailHtml }),
  openGmailPreview: (rfc822msgid, messageId, subject, from) => ipcRenderer.invoke('open-gmail-preview', { rfc822msgid, messageId, subject, from }),
  captureGmailScreenshot: (rfc822msgid, defaultFilename) => ipcRenderer.invoke('capture-gmail-screenshot', { rfc822msgid, defaultFilename }),
  captureGmailMailbody: (messageId, rfc822msgid, defaultFilename) => ipcRenderer.invoke('capture-gmail-mailbody', { messageId, rfc822msgid, defaultFilename }),
}); 