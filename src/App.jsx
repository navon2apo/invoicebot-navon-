import { useState, useEffect, useRef } from 'react'
import './index.css'
import EmailGenerator from './email-generator.js'
import Toolbar from './components/Toolbar.jsx'
import ToastManager from './components/ToastManager.jsx'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [invoices, setInvoices] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInvoices, setSelectedInvoices] = useState([])
  const [emailGenerator] = useState(() => new EmailGenerator())
  
  // Date filtering state
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [useDateFilter, setUseDateFilter] = useState(true)

  const [savedFilesInfo, setSavedFilesInfo] = useState([]); // סטייט חדש לרשימת קבצים שנשמרו
  const [savedFolderPath, setSavedFolderPath] = useState(''); // סטייט לנתיב התיקייה
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [customFolderName, setCustomFolderName] = useState('');
  const folderNameInputRef = useRef(null);
  const [previewFile, setPreviewFile] = useState(null); // {type, url, filename}
  const [showEmailBody, setShowEmailBody] = useState(null); // id של המייל שמוצג כרגע
  const [emailBodyHtml, setEmailBodyHtml] = useState('');

  useEffect(() => {
    // Check if already authenticated
    checkAuthStatus()
    
    // Set default date range (last 3 months)
    const today = new Date()
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    
    setEndDate(today.toISOString().split('T')[0])
    setStartDate(threeMonthsAgo.toISOString().split('T')[0])
  }, [])

  const checkAuthStatus = async () => {
    try {
      const result = await window.electronAPI.checkAuthToken()
      setIsAuthenticated(result.isValid)
      if (result.isValid) {
        setStatus('✅ מחובר ל-Google בהצלחה')
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
    }
  }

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    setStatus('🔐 מתחבר ל-Google...')
    
    try {
      const result = await window.electronAPI.authenticateGoogle()
      
      if (result.success) {
        setIsAuthenticated(true)
        setStatus('✅ התחברות ל-Google הושלמה בהצלחה!')
      } else if (result.modernFlow && result.needsWait) {
        // New flow: server is running, just wait
        setStatus(result.message)
        
        // Poll for authentication completion
        let attempts = 0
        const maxAttempts = 60 // 5 minutes
        
        const pollAuth = async () => {
          attempts++
          try {
            const authCheck = await window.electronAPI.checkAuthToken()
            if (authCheck.isValid) {
              setIsAuthenticated(true)
              setStatus('✅ אימות הושלם בהצלחה!')
              setIsLoading(false)
              return
            }
            
            if (attempts < maxAttempts) {
              setTimeout(pollAuth, 5000) // Check every 5 seconds
            } else {
              setStatus('❌ תם הזמן הקצוב לאימות')
              setIsLoading(false)
            }
          } catch (error) {
            if (attempts < maxAttempts) {
              setTimeout(pollAuth, 5000)
            } else {
              setStatus('❌ שגיאה בבדיקת האימות')
              setIsLoading(false)
            }
          }
        }
        
        setTimeout(pollAuth, 3000) // Start polling after 3 seconds
        return // Don't set loading to false yet
        
      } else if (result.needsAuthCode) {
        // Fallback to old flow
        setStatus(result.message)
        const authCode = prompt('הדפדפן נפתח לאימות Google. אנא העתק את הקוד שקיבלת והכנס אותו כאן:')
        if (authCode) {
          setStatus('🔐 מאמת קוד...')
          const authResult = await window.electronAPI.submitAuthCode(authCode.trim())
          if (authResult.success) {
            setIsAuthenticated(true)
            setStatus('✅ אימות הושלם בהצלחה!')
          } else {
            setStatus('❌ שגיאה באימות הקוד: ' + authResult.error)
          }
        } else {
          setStatus('❌ אימות בוטל')
        }
      } else {
        setStatus('❌ שגיאה בהתחברות: ' + (result.error || result.message))
      }
    } catch (error) {
      setStatus('❌ שגיאה בהתחברות: ' + error.message)
    } finally {
      if (!result?.modernFlow || !result?.needsWait) {
        setIsLoading(false)
      }
    }
  }

  const handleGoogleLogout = async () => {
    setIsLoading(true)
    setStatus('🔓 מתנתק מ-Google...')
    
    try {
      const result = await window.electronAPI.logoutGoogle()
      
      if (result.success) {
        setIsAuthenticated(false)
        setInvoices([])
        setSelectedInvoices([])
        setStatus('✅ ' + result.message)
      } else {
        setStatus('❌ ' + result.message)
      }
    } catch (error) {
      setStatus('❌ שגיאה בהתנתקות: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleScanEmails = async () => {
    if (!isAuthenticated) {
      setStatus('❌ יש להתחבר ל-Google תחילה')
      return
    }

    setIsLoading(true)
    setStatus('🔍 סורק מיילים לחיפוש חשבוניות...')
    
    try {
      let result
      
      if (useDateFilter && startDate && endDate) {
        // Convert dates to Gmail format (YYYY/MM/DD)
        const gmailStartDate = startDate.replace(/-/g, '/')
        const gmailEndDate = endDate.replace(/-/g, '/')
        
        setStatus(`🔍 סורק מיילים מ-${startDate} עד ${endDate}...`)
        result = await window.electronAPI.searchInvoiceEmailsWithDates(gmailStartDate, gmailEndDate)
      } else {
        result = await window.electronAPI.searchInvoiceEmails()
      }
      
      if (result.success) {
        setInvoices(result.emails || [])
        const dateRangeText = useDateFilter ? ` בטווח ${startDate} עד ${endDate}` : ''
        setStatus(`✅ נמצאו ${result.emails?.length || 0} מיילים עם חשבוניות אפשריות${dateRangeText}`)
      } else {
        setStatus('❌ שגיאה בסריקת מיילים: ' + result.error)
      }
    } catch (error) {
      setStatus('❌ שגיאה בסריקת מיילים: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // עיבוד והורדה עם אפשרות לשינוי שם תיקייה
  const handleProcessAndDownload = async () => {
    if (selectedInvoices.length === 0) {
      setStatus('❌ יש לבחור חשבוניות לעיבוד והורדה');
      return;
    }
    setIsLoading(true);
    setStatus('🔄 מעבד ושומר קבצים...');
    setSavedFilesInfo([]);
    setSavedFolderPath('');
    const allSavedFiles = [];
    let folderPath = '';
    let folderName = customFolderName.trim();
    try {
      for (let i = 0; i < selectedInvoices.length; i++) {
        const emailId = selectedInvoices[i];
        const currentInvoice = invoices.find(inv => inv.id === emailId);
        setStatus(`🔄 מעבד חשבונית ${i + 1}/${selectedInvoices.length}: ${currentInvoice?.subject || emailId}`);
        try {
          const result = await window.electronAPI.processInvoiceAttachments(emailId);
          // עדכון סטטוס עיבוד
          setInvoices(prev => prev.map(invoice =>
            invoice.id === emailId
              ? { ...invoice, processedData: result, isProcessed: true }
              : invoice
          ));
          // שמירת קבצים (אם יש)
          if (currentInvoice.attachments && currentInvoice.attachments.length > 0) {
            // שלח את שם התיקייה המותאם (אם הוזן)
            const saveResult = await window.electronAPI.saveAttachmentsToFolder(currentInvoice.attachments, currentInvoice.date || new Date().toISOString(), folderName);
            if (saveResult.success) {
              allSavedFiles.push(...saveResult.savedFiles.map(f => ({
                file: f,
                emailSubject: currentInvoice.subject
              })));
              if (!folderPath && saveResult.savedFiles.length > 0) {
                // שמור את נתיב התיקייה הראשונה
                folderPath = fspFolderOnly(saveResult.savedFiles[0]);
              }
            }
          }
        } catch (error) {
          // המשך גם אם יש שגיאה באחת החשבוניות
          allSavedFiles.push({ file: 'שגיאה: ' + error.message, emailSubject: currentInvoice.subject });
        }
      }
      setSavedFilesInfo(allSavedFiles);
      setSavedFolderPath(folderPath);
      setShowDownloadModal(true);
      setStatus(`✅ נשמרו ${allSavedFiles.length} קבצים. ניתן לפתוח את התיקייה.`);
    } catch (error) {
      setStatus('❌ שגיאה בעיבוד/הורדה: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // עוזר להוציא רק את נתיב התיקייה מהנתיב המלא
  function fspFolderOnly(fullPath) {
    if (!fullPath) return '';
    const parts = fullPath.split(/\\|\//);
    parts.pop();
    return parts.join('/');
  }

  const toggleInvoiceSelection = (emailId) => {
    setSelectedInvoices(prev => 
      prev.includes(emailId) 
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    )
  }

  const selectAllInvoices = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(filteredInvoices.map(invoice => invoice.id))
    }
  }

  const filteredInvoices = invoices.filter(invoice => 
    invoice.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    invoice.from?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const testElectron = async () => {
    try {
      const result = await window.electronAPI.testConnection()
      setStatus('🔗 חיבור Electron עובד: ' + result.message)
    } catch (error) {
      setStatus('❌ שגיאה בחיבור Electron: ' + error.message)
    }
  }

  const handleGenerateEmailSummary = async () => {
    const processedInvoices = invoices.filter(inv => inv.isProcessed)
    
    if (processedInvoices.length === 0) {
      setStatus('❌ אין חשבוניות מעובדות ליצירת סיכום')
      return
    }

    try {
      setIsLoading(true)
      setStatus('📧 יוצר מייל סיכום...')
      
      const emailContent = emailGenerator.generateAccountantSummary(processedInvoices)
      
      // Create and download HTML file
      const htmlBlob = new Blob([emailContent.htmlBody], { type: 'text/html;charset=utf-8' })
      const htmlUrl = URL.createObjectURL(htmlBlob)
      const htmlLink = document.createElement('a')
      htmlLink.href = htmlUrl
      htmlLink.download = `invoice-summary-${new Date().toISOString().split('T')[0]}.html`
      htmlLink.click()
      
      // Create and download text version
      const textBlob = new Blob([emailContent.textBody], { type: 'text/plain;charset=utf-8' })
      const textUrl = URL.createObjectURL(textBlob)
      const textLink = document.createElement('a')
      textLink.href = textUrl
      textLink.download = `invoice-summary-${new Date().toISOString().split('T')[0]}.txt`
      textLink.click()
      
      setStatus(`✅ מייל סיכום נוצר בהצלחה! נושא: ${emailContent.subject}`)
    } catch (error) {
      setStatus('❌ שגיאה ביצירת מייל סיכום: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportCSV = async () => {
    const processedInvoices = invoices.filter(inv => inv.isProcessed)
    
    if (processedInvoices.length === 0) {
      setStatus('❌ אין חשבוניות מעובדות לייצוא')
      return
    }

    try {
      setIsLoading(true)
      setStatus('📊 יוצר קובץ CSV...')
      
      const csvContent = emailGenerator.generateCSVExport(processedInvoices)
      
      // Download CSV file
      const csvBlob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' }) // BOM for Hebrew support
      const csvUrl = URL.createObjectURL(csvBlob)
      const csvLink = document.createElement('a')
      csvLink.href = csvUrl
      csvLink.download = `invoices-export-${new Date().toISOString().split('T')[0]}.csv`
      csvLink.click()
      
      setStatus('✅ קובץ CSV נוצר והורד בהצלחה!')
    } catch (error) {
      setStatus('❌ שגיאה ביצירת קובץ CSV: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // פונקציה חדשה לשמירת קבצים לתיקייה
  const handleSaveAttachments = async (attachments, invoiceDate) => {
    const result = await window.electronAPI.saveAttachmentsToFolder(attachments, invoiceDate);
    if (result.success) {
      setStatus(`✅ נשמרו ${result.savedFiles.length} קבצים לתיקייה`);
    } else {
      setStatus(`❌ שגיאה בשמירת קבצים: ${result.error}`);
    }
  };

  // הצגת preview לצרופות
  const handlePreviewAttachment = (att) => {
    if (att.mimeType && att.mimeType.startsWith('image/')) {
      // תמונה
      setPreviewFile({ type: 'image', url: `data:${att.mimeType};base64,${att.data}`, filename: att.filename });
    } else if (att.mimeType === 'application/pdf') {
      // PDF - פתח בחלון חדש
      const blob = new Blob([Uint8Array.from(atob(att.data), c => c.charCodeAt(0))], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewFile({ type: 'pdf', url, filename: att.filename });
    } else {
      setPreviewFile(null);
    }
  };
  const handleClosePreview = () => {
    setPreviewFile(null);
  };



  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Toolbar Component */}
      <Toolbar
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
        onGoogleAuth={handleGoogleAuth}
        onGoogleLogout={handleGoogleLogout}
        onScanEmails={handleScanEmails}
        onTestElectron={testElectron}
      />

      {/* Toast Manager */}
      <ToastManager status={status} isLoading={isLoading} />

      {/* Main Content Container */}
      <div className="container mx-auto px-4 py-6 max-w-7xl">

        {/* Date Filtering Panel */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📅 פילטר תאריכים</h2>
          
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useDateFilter}
                onChange={(e) => setUseDateFilter(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">השתמש בפילטר תאריכים</span>
            </label>
          </div>

          {useDateFilter && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  תאריך התחלה
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  תאריך סיום
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {useDateFilter && startDate && endDate && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700 mb-0">
                🔍 יחפש מיילים מ-<strong>{startDate}</strong> עד <strong>{endDate}</strong>
                {' '}({Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))} ימים)
              </p>
            </div>
          )}
        </div>

        {/* Statistics Section */}
        {invoices.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📊 סטטיסטיקות</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{invoices.length}</div>
                <div className="text-sm text-gray-600">מיילים נמצאו</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {invoices.filter(inv => inv.isProcessed).length}
                </div>
                <div className="text-sm text-gray-600">מעובדים</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {invoices.reduce((sum, inv) => sum + (inv.attachments?.length || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">קבצים מצורפים</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {(() => {
                    const processedInvoices = invoices.filter(inv => inv.isProcessed)
                    if (processedInvoices.length === 0) return '0'
                    const totalAmount = processedInvoices.reduce((sum, invoice) => {
                      return sum + (invoice.processedData?.processedAttachments?.filter(att => att.success && att.invoiceData?.totalAmount) || [])
                        .reduce((attSum, att) => attSum + att.invoiceData.totalAmount, 0)
                    }, 0)
                    return totalAmount.toLocaleString()
                  })()}
                </div>
                <div className="text-sm text-gray-600">סה"כ ש"ח</div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Management Section */}
        {invoices.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                📋 חשבוניות שנמצאו ({filteredInvoices.length})
              </h2>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={selectAllInvoices}
                  className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                >
                  {selectedInvoices.length === filteredInvoices.length ? 'בטל בחירה' : 'בחר הכל'}
                </button>
                <button
                  onClick={handleProcessAndDownload}
                  disabled={selectedInvoices.length === 0 || isLoading}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  🔄 עבד והורד ({selectedInvoices.length})
                </button>
                <button
                  onClick={handleGenerateEmailSummary}
                  disabled={invoices.filter(inv => inv.isProcessed).length === 0 || isLoading}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  📧 יצר סיכום
                </button>
                <button
                  onClick={handleExportCSV}
                  disabled={invoices.filter(inv => inv.isProcessed).length === 0 || isLoading}
                  className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  📊 יצא CSV
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="חפש חשבוניות לפי נושא או שולח..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Invoice List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  data-email-id={invoice.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                    selectedInvoices.includes(invoice.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleInvoiceSelection(invoice.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.includes(invoice.id)}
                          onChange={() => toggleInvoiceSelection(invoice.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <h3 className="font-semibold text-gray-900 line-clamp-1">
                          {invoice.subject}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        📧 מאת: {invoice.from}
                      </p>
                                             <p className="text-xs text-gray-500">
                         📅 {new Date(parseInt(invoice.internalDate)).toLocaleDateString('he-IL')}
                       </p>
                       {/* הצגת כל ה-attachments לפי metadata בלבד */}
                       {invoice.attachments && invoice.attachments.length > 0 && (
                         <div className="flex gap-1 mt-1">
                           {invoice.attachments.map((att, i) => (
                             <span key={i} className="cursor-pointer hover:opacity-75 transition-opacity"
                               onClick={async e => {
                                 e.stopPropagation();
                                 setStatus('מוריד קובץ...');
                                 const res = await window.electronAPI.downloadAttachment(invoice.id, att.id);
                                 if (res.success) {
                                   if (att.mimeType && att.mimeType.startsWith('image/')) {
                                     setPreviewFile({ type: 'image', url: `data:${att.mimeType};base64,${res.data}`, filename: att.filename });
                                   } else if (att.mimeType === 'application/pdf') {
                                     const blob = new Blob([Uint8Array.from(atob(res.data), c => c.charCodeAt(0))], { type: 'application/pdf' });
                                     const url = URL.createObjectURL(blob);
                                     setPreviewFile({ type: 'pdf', url, filename: att.filename });
                                   } else {
                                     // הורדה ישירה
                                     const saveRes = await window.electronAPI.saveFileDialog(att.filename, res.data);
                                     if (saveRes.success) setStatus('✅ נשמר בהצלחה: ' + saveRes.filePath);
                                     else setStatus('❌ שמירה בוטלה או נכשלה');
                                   }
                                 } else {
                                   setStatus('❌ שגיאה בהורדה: ' + res.error);
                                 }
                               }}
                               title={`שם: ${att.filename}\nסוג: ${att.mimeType || ''}\nגודל: ${att.size ? att.size + ' bytes' : ''}`}
                             >
                               {att.mimeType && att.mimeType.startsWith('image/') ? (
                                 <span className="text-lg text-blue-600">🖼️</span>
                               ) : att.mimeType === 'application/pdf' ? (
                                 <span className="text-lg text-red-700">📄</span>
                               ) : (
                                 <span className="text-base">📎</span>
                               )}
                             </span>
                           ))}
                           <span className="text-xs text-blue-600">{invoice.attachments.length} קבצים מצורפים</span>
                         </div>
                       )}
                       {invoice.isProcessed && (
                         <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                           <p className="text-green-800 font-semibold mb-1">✅ עובד</p>
                           {invoice.processedData?.processedAttachments?.map((att, idx) => (
                             <div key={idx} className="mb-1">
                               {att.success ? (
                                 <div className="text-green-700">
                                   <p><strong>{att.filename}</strong></p>
                                   {att.invoiceData?.companyName && (
                                     <p>חברה: {att.invoiceData.companyName}</p>
                                   )}
                                   {att.invoiceData?.totalAmount && (
                                     <p>סכום: {att.invoiceData.totalAmount} ש"ח</p>
                                   )}
                                   {att.invoiceData?.date && (
                                     <p>תאריך: {att.invoiceData.date}</p>
                                   )}
                                 </div>
                               ) : (
                                 <div className="text-red-600">
                                   <p><strong>{att.filename}</strong> - שגיאה: {att.error}</p>
                                 </div>
                               )}
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                  </div>
                  {/* כפתור פעולה יחיד */}
                  <div className="mt-2">
                    <button onClick={async e => {
                      e.stopPropagation();
                      setStatus('פותח Gmail לצילום...');
                      const previewResult = await window.electronAPI.openGmailPreview(invoice.rfc822msgid, invoice.id, invoice.subject, invoice.from);
                      if (previewResult.success) setStatus('✅ Gmail נפתח - השתמש בכפתור הצילום הכחול');
                      else setStatus('❌ שגיאה בפתיחת Gmail: ' + previewResult.error);
                    }} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors shadow-md">
                      📧 פתח לצילום בGmail
                    </button>
                    <div className="text-xs text-gray-500 mt-1">
                      💡 יפתח את המייל בGmail עם כפתור צילום מובנה
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {invoices.length === 0 && isAuthenticated && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              עדיין לא נסרקו מיילים
            </h3>
            <p className="text-gray-500 mb-4">
              לחץ על "סרוק מיילים" כדי להתחיל לחפש חשבוניות ב-Gmail שלך
            </p>
          </div>
        )}
        {savedFilesInfo.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <div className="mb-2 font-bold text-blue-700 text-sm">✅ קבצים שנשמרו:</div>
            <ul className="text-xs space-y-1">
              {savedFilesInfo.map((f, idx) => (
                <li key={idx} className="text-gray-700">
                  {f.file} <span className="text-gray-500">({f.emailSubject})</span>
                </li>
              ))}
            </ul>
            {savedFolderPath && (
              <button
                className="mt-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
                onClick={() => window.electronAPI.openExternal('file://' + savedFolderPath)}
              >
                פתח תיקייה
              </button>
            )}
          </div>
        )}

        {/* הצגת preview בפופאפ */}
        {previewFile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={handleClosePreview}>
            <div className="bg-white rounded-lg shadow-xl max-w-[90vw] max-h-[90vh] relative overflow-hidden" onClick={e => e.stopPropagation()}>
              <button 
                onClick={handleClosePreview} 
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl font-bold bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md transition-colors z-10"
              >
                ✖
              </button>
              <div className="p-6">
                <div className="mb-4 font-bold text-gray-800 text-lg">{previewFile.filename}</div>
                {previewFile.type === 'image' ? (
                  <img 
                    src={previewFile.url} 
                    alt={previewFile.filename} 
                    className="max-w-[80vw] max-h-[70vh] border border-gray-300 rounded-lg object-contain"
                  />
                ) : previewFile.type === 'pdf' ? (
                  <iframe 
                    src={previewFile.url} 
                    title={previewFile.filename} 
                    className="w-[70vw] h-[70vh] border-none rounded-lg"
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* פידבק הורדה popup */}
        {showDownloadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md relative p-6">
              <button 
                onClick={()=>setShowDownloadModal(false)} 
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold transition-colors"
              >
                ✖
              </button>
              <div className="text-xl font-bold text-blue-600 mb-4">✔️ קבצים נשמרו בהצלחה</div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  שם תיקייה (ניתן לשנות לפני שמירה הבאה):
                </label>
                <input 
                  ref={folderNameInputRef} 
                  value={customFolderName} 
                  onChange={e=>setCustomFolderName(e.target.value)} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <ul className="max-h-40 overflow-y-auto text-sm space-y-1 mb-4">
                {savedFilesInfo.map((f, idx) => (
                  <li key={idx} className="text-gray-700">
                    {f.file} <span className="text-gray-500">({f.emailSubject})</span>
                  </li>
                ))}
              </ul>
              {savedFolderPath && (
                <button
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  onClick={() => window.electronAPI.openExternal('file://' + savedFolderPath)}
                >
                  פתח תיקייה
                </button>
              )}
            </div>
          </div>
        )}

        {/* הצג מודאל עם גוף המייל (rendered HTML) */}
        {showEmailBody && (
          <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" onClick={()=>setShowEmailBody(null)}>
            <div id="email-body-modal" className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-y-auto relative p-6" onClick={e=>e.stopPropagation()}>
              <button 
                onClick={()=>setShowEmailBody(null)} 
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold transition-colors z-10"
              >
                ✖
              </button>
              <div className="text-xl font-bold text-blue-600 mb-4">גוף המייל</div>
              {/* הצג את גוף המייל בתוך iframe */}
              <iframe
                id="email-body-iframe"
                title="email-body"
                src={"data:text/html;charset=utf-8," + encodeURIComponent(emailBodyHtml)}
                className="w-full min-h-96 border border-gray-300 rounded-lg bg-white mb-4"
                sandbox="allow-same-origin allow-popups allow-forms allow-scripts"
              />
              <button 
                onClick={async e => {
                  e.stopPropagation();
                  setStatus('יוצר צילום גוף מייל...');
                  // שלח את ה-HTML המקורי ל-Electron לצילום
                  const res = await window.electronAPI.captureMailScreenshot(emailBodyHtml);
                  if (res.success) {
                    setStatus('✅ צילום גוף המייל נשמר בהצלחה! ' + res.filePath);
                  } else if (res.canceled) {
                    setStatus('צילום בוטל');
                  } else {
                    setStatus('❌ שגיאה בצילום גוף המייל: ' + res.error);
                  }
                }} 
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                צלם את גוף המייל
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App 