import { useState, useEffect } from 'react'
import './index.css'
import EmailGenerator from './email-generator.js'

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

  const handleProcessSelectedInvoices = async () => {
    if (selectedInvoices.length === 0) {
      setStatus('❌ יש לבחור חשבוניות לעיבוד')
      return
    }

    setIsLoading(true)
    const processedResults = []
    
    try {
      for (let i = 0; i < selectedInvoices.length; i++) {
        const emailId = selectedInvoices[i]
        const currentInvoice = invoices.find(inv => inv.id === emailId)
        
        setStatus(`🔄 מעבד חשבונית ${i + 1}/${selectedInvoices.length}: ${currentInvoice?.subject || emailId}`)
        
        try {
          const result = await window.electronAPI.processInvoiceAttachments(emailId)
          processedResults.push(result)
          
          // Update the invoice with processed data
          setInvoices(prev => prev.map(invoice => 
            invoice.id === emailId 
              ? { ...invoice, processedData: result, isProcessed: true }
              : invoice
          ))
          
        } catch (error) {
          console.error(`Error processing invoice ${emailId}:`, error)
          processedResults.push({
            emailId,
            success: false,
            error: error.message
          })
        }
      }
      
      const successCount = processedResults.filter(r => r.success).length
      const errorCount = processedResults.length - successCount
      
      if (errorCount === 0) {
        setStatus(`✅ עיבוד הושלם בהצלחה עבור ${successCount} חשבוניות`)
      } else {
        setStatus(`⚠️ עיבוד הושלם: ${successCount} הצליחו, ${errorCount} נכשלו`)
      }
      
    } catch (error) {
      setStatus('❌ שגיאה בעיבוד החשבוניות: ' + error.message)
    } finally {
      setIsLoading(false)
    }
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

  return (
    <div className="container" dir="rtl">
      <div style={{textAlign: 'center', marginBottom: '30px'}}>
        <h1 style={{fontSize: '2rem', fontWeight: 'bold', color: '#333', marginBottom: '10px'}}>
          🤖 InvoiceBot
        </h1>
        <p style={{fontSize: '1.1rem', color: '#666'}}>
          מערכת אוטומטית לאיסוף וניהול חשבוניות מ-Gmail
        </p>
      </div>

      {/* Main Control Panel */}
      <div style={{background: 'white', borderRadius: '12px', padding: '25px', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px'}}>
          <button
            onClick={handleGoogleAuth}
            disabled={isLoading || isAuthenticated}
            className={isAuthenticated ? 'btn-success' : 'btn-primary'}
          >
            {isAuthenticated ? '✅ מחובר ל-Google' : '🔐 התחבר ל-Google'}
          </button>

          <button
            onClick={handleScanEmails}
            disabled={isLoading || !isAuthenticated}
            className="btn-purple"
          >
            🔍 סרוק מיילים
          </button>

          <button
            onClick={testElectron}
            disabled={isLoading}
            className="btn-gray"
          >
            🔗 בדיקת Electron
          </button>
        </div>

        {/* Status Display */}
        <div style={{background: '#f8f9fa', borderRadius: '8px', padding: '15px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            {isLoading && (
              <div style={{width: '20px', height: '20px', border: '2px solid #007bff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>
            )}
            <span style={{fontSize: '14px', fontWeight: '500', color: '#333'}}>
              {status || 'מוכן לעבודה...'}
            </span>
          </div>
        </div>
      </div>

      {/* Date Filtering Panel */}
      <div style={{background: 'white', borderRadius: '12px', padding: '25px', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}>
        <h2 style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#333', marginBottom: '15px'}}>📅 פילטר תאריכים</h2>
        
        <div style={{display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px'}}>
          <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            <input
              type="checkbox"
              checked={useDateFilter}
              onChange={(e) => setUseDateFilter(e.target.checked)}
            />
            <span style={{fontSize: '14px', fontWeight: '500', color: '#333'}}>השתמש בפילטר תאריכים</span>
          </label>
        </div>

        {useDateFilter && (
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px'}}>
            <div>
              <label style={{display: 'block', fontSize: '14px', fontWeight: '500', color: '#333', marginBottom: '8px'}}>
                תאריך התחלה
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{width: '100%'}}
              />
            </div>
            
            <div>
              <label style={{display: 'block', fontSize: '14px', fontWeight: '500', color: '#333', marginBottom: '8px'}}>
                תאריך סיום
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{width: '100%'}}
              />
            </div>
          </div>
        )}

        {useDateFilter && startDate && endDate && (
          <div style={{marginTop: '15px', padding: '12px', background: '#e3f2fd', borderRadius: '8px'}}>
            <p style={{fontSize: '14px', color: '#1565c0', margin: 0}}>
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
                  onClick={handleProcessSelectedInvoices}
                  disabled={selectedInvoices.length === 0 || isLoading}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  🔄 עבד נבחרים ({selectedInvoices.length})
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
                       {invoice.attachments && invoice.attachments.length > 0 && (
                         <p className="text-xs text-blue-600 mt-1">
                           📎 {invoice.attachments.length} קבצים מצורפים
                         </p>
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
    </div>
  )
}

export default App 