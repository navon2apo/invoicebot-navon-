/**
 * Email Generator - יוצר מיילי סיכום
 * יוצר מיילי סיכום מובנים לרואה החשבון עם פירוט החשבוניות
 */

export class EmailGenerator {
  constructor() {
    this.currency = 'ש"ח'
  }

  /**
   * יצירת מייל סיכום מפורט לרואה החשבון
   */
  generateAccountantSummary(processedInvoices, period = null) {
    const summary = this.analyzeBatch(processedInvoices)
    
    const emailContent = {
      subject: this.generateSubject(summary, period),
      htmlBody: this.generateHTMLBody(summary, processedInvoices, period),
      textBody: this.generateTextBody(summary, processedInvoices, period),
      attachments: []
    }

    return emailContent
  }

  /**
   * ניתוח קבוצת חשבוניות
   */
  analyzeBatch(processedInvoices) {
    const validInvoices = processedInvoices.filter(inv => 
      inv.processedData?.processedAttachments?.some(att => att.success)
    )

    const totalAmount = validInvoices.reduce((sum, invoice) => {
      return sum + invoice.processedData.processedAttachments
        .filter(att => att.success && att.invoiceData?.totalAmount)
        .reduce((attSum, att) => attSum + att.invoiceData.totalAmount, 0)
    }, 0)

    const totalVAT = validInvoices.reduce((sum, invoice) => {
      return sum + invoice.processedData.processedAttachments
        .filter(att => att.success && att.invoiceData?.taxAmount)
        .reduce((attSum, att) => attSum + att.invoiceData.taxAmount, 0)
    }, 0)

    const companies = new Set()
    const categories = {}

    validInvoices.forEach(invoice => {
      invoice.processedData.processedAttachments
        .filter(att => att.success)
        .forEach(att => {
          if (att.invoiceData?.companyName) {
            companies.add(att.invoiceData.companyName)
          }
          
          // קטגוריזציה בסיסית לפי שם החברה או נושא המייל
          const category = this.categorizeInvoice(att, invoice)
          categories[category] = (categories[category] || 0) + (att.invoiceData?.totalAmount || 0)
        })
    })

    return {
      totalInvoices: validInvoices.length,
      totalAmount,
      totalVAT,
      netAmount: totalAmount - totalVAT,
      uniqueCompanies: companies.size,
      companies: Array.from(companies),
      categories,
      period: this.detectPeriod(validInvoices)
    }
  }

  /**
   * יצירת נושא המייל
   */
  generateSubject(summary, period) {
    const periodStr = period || summary.period || new Date().toLocaleDateString('he-IL')
    return `סיכום חשבוניות ${periodStr} - ${summary.totalInvoices} חשבוניות, סה"כ ${summary.totalAmount.toLocaleString()} ${this.currency}`
  }

  /**
   * יצירת גוף המייל בפורמט HTML
   */
  generateHTMLBody(summary, processedInvoices, period) {
    const validInvoices = processedInvoices.filter(inv => 
      inv.processedData?.processedAttachments?.some(att => att.success)
    )

    return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>סיכום חשבוניות</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; direction: rtl; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary-box { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .invoice-item { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 8px; }
        .company-name { font-weight: bold; color: #1976d2; }
        .amount { font-weight: bold; color: #2e7d32; }
        .error { color: #d32f2f; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
        th { background-color: #f5f5f5; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 סיכום חשבוניות</h1>
        <p><strong>תאריך יצירה:</strong> ${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL')}</p>
        ${period ? `<p><strong>תקופה:</strong> ${period}</p>` : ''}
        <p><strong>נוצר באמצעות:</strong> InvoiceBot 🤖</p>
    </div>

    <div class="summary-box">
        <h2>📈 סיכום כללי</h2>
        <ul>
            <li><strong>סה"כ חשבוניות:</strong> ${summary.totalInvoices}</li>
            <li><strong>סה"כ לפני מע"מ:</strong> ${summary.netAmount.toLocaleString()} ${this.currency}</li>
            <li><strong>סה"כ מע"מ:</strong> ${summary.totalVAT.toLocaleString()} ${this.currency}</li>
            <li><strong>סה"כ כולל מע"מ:</strong> ${summary.totalAmount.toLocaleString()} ${this.currency}</li>
            <li><strong>חברות שונות:</strong> ${summary.uniqueCompanies}</li>
        </ul>
    </div>

    ${Object.keys(summary.categories).length > 0 ? this.generateCategoriesHTML(summary.categories) : ''}

    <h2>📋 פירוט חשבוניות</h2>
    ${validInvoices.map(invoice => this.generateInvoiceItemHTML(invoice)).join('')}

    <div class="footer">
        <p>נוצר אוטומטית על ידי InvoiceBot | ${new Date().toISOString()}</p>
        <p>בכל שאלה או בעיה, אנא פנה למחלקת ההנהלה.</p>
    </div>
</body>
</html>
    `.trim()
  }

  /**
   * יצירת טבלת קטגוריות
   */
  generateCategoriesHTML(categories) {
    return `
    <div class="summary-box">
        <h2>🏷️ פירוט לפי קטגוריות</h2>
        <table>
            <thead>
                <tr>
                    <th>קטגוריה</th>
                    <th>סכום</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(categories).map(([category, amount]) => `
                <tr>
                    <td>${category}</td>
                    <td class="amount">${amount.toLocaleString()} ${this.currency}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    `
  }

  /**
   * יצירת פריט חשבונית ב-HTML
   */
  generateInvoiceItemHTML(invoice) {
    const successfulAttachments = invoice.processedData.processedAttachments.filter(att => att.success)
    const failedAttachments = invoice.processedData.processedAttachments.filter(att => !att.success)

    return `
    <div class="invoice-item">
        <h3>📧 ${invoice.subject}</h3>
        <p><strong>מאת:</strong> ${invoice.from}</p>
        <p><strong>תאריך:</strong> ${new Date(parseInt(invoice.internalDate)).toLocaleDateString('he-IL')}</p>
        
        ${successfulAttachments.map(att => `
        <div style="margin: 10px 0; padding: 10px; background: #f0f8f0; border-radius: 5px;">
            <p><strong>📎 ${att.filename}</strong></p>
            ${att.invoiceData?.companyName ? `<p class="company-name">🏢 ${att.invoiceData.companyName}</p>` : ''}
            ${att.invoiceData?.invoiceNumber ? `<p><strong>מספר חשבונית:</strong> ${att.invoiceData.invoiceNumber}</p>` : ''}
            ${att.invoiceData?.date ? `<p><strong>תאריך חשבונית:</strong> ${att.invoiceData.date}</p>` : ''}
            ${att.invoiceData?.totalAmount ? `<p class="amount">💰 ${att.invoiceData.totalAmount.toLocaleString()} ${this.currency}</p>` : ''}
            ${att.invoiceData?.taxAmount ? `<p><strong>מע"מ:</strong> ${att.invoiceData.taxAmount.toLocaleString()} ${this.currency}</p>` : ''}
        </div>
        `).join('')}
        
        ${failedAttachments.map(att => `
        <div style="margin: 10px 0; padding: 10px; background: #fff0f0; border-radius: 5px;">
            <p class="error"><strong>❌ ${att.filename}</strong> - שגיאה: ${att.error}</p>
        </div>
        `).join('')}
    </div>
    `
  }

  /**
   * יצירת גוף המייל בפורמט טקסט רגיל
   */
  generateTextBody(summary, processedInvoices, period) {
    const validInvoices = processedInvoices.filter(inv => 
      inv.processedData?.processedAttachments?.some(att => att.success)
    )

    let text = `
📊 סיכום חשבוניות - InvoiceBot
===============================================

תאריך יצירה: ${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL')}
${period ? `תקופה: ${period}` : ''}

📈 סיכום כללי:
---------------------------
• סה"כ חשבוניות: ${summary.totalInvoices}
• סה"כ לפני מע"מ: ${summary.netAmount.toLocaleString()} ${this.currency}
• סה"כ מע"מ: ${summary.totalVAT.toLocaleString()} ${this.currency}
• סה"כ כולל מע"מ: ${summary.totalAmount.toLocaleString()} ${this.currency}
• חברות שונות: ${summary.uniqueCompanies}

🏷️ פירוט לפי קטגוריות:
---------------------------
${Object.entries(summary.categories).map(([category, amount]) => 
  `• ${category}: ${amount.toLocaleString()} ${this.currency}`
).join('\n')}

📋 פירוט חשבוניות:
===============================================
`

    validInvoices.forEach((invoice, index) => {
      text += `
${index + 1}. ${invoice.subject}
   מאת: ${invoice.from}
   תאריך: ${new Date(parseInt(invoice.internalDate)).toLocaleDateString('he-IL')}
   
   קבצים מצורפים:`
      
      const successfulAttachments = invoice.processedData.processedAttachments.filter(att => att.success)
      const failedAttachments = invoice.processedData.processedAttachments.filter(att => !att.success)
      
      successfulAttachments.forEach(att => {
        text += `
   📎 ${att.filename}`
        if (att.invoiceData?.companyName) text += `\n      🏢 ${att.invoiceData.companyName}`
        if (att.invoiceData?.invoiceNumber) text += `\n      מס' חשבונית: ${att.invoiceData.invoiceNumber}`
        if (att.invoiceData?.date) text += `\n      תאריך חשבונית: ${att.invoiceData.date}`
        if (att.invoiceData?.totalAmount) text += `\n      💰 ${att.invoiceData.totalAmount.toLocaleString()} ${this.currency}`
        if (att.invoiceData?.taxAmount) text += `\n      מע"מ: ${att.invoiceData.taxAmount.toLocaleString()} ${this.currency}`
      })
      
      failedAttachments.forEach(att => {
        text += `\n   ❌ ${att.filename} - שגיאה: ${att.error}`
      })
      
      text += '\n'
    })

    text += `
------------------------------------------
נוצר אוטומטית על ידי InvoiceBot 🤖
${new Date().toISOString()}
`

    return text.trim()
  }

  /**
   * קטגוריזציה אוטומטית של חשבונית
   */
  categorizeInvoice(attachment, email) {
    const text = (attachment.extractedText || '').toLowerCase()
    const subject = (email.subject || '').toLowerCase()
    const company = attachment.invoiceData?.companyName || ''

    // קטגוריות בסיסיות
    if (text.includes('חשמל') || text.includes('חברת חשמל') || company.includes('חשמל')) {
      return 'חשמל ואנרגיה'
    }
    if (text.includes('מים') || text.includes('מי') || company.includes('מים')) {
      return 'מים וביוב'
    }
    if (text.includes('גז') || company.includes('גז')) {
      return 'גז'
    }
    if (text.includes('אינטרנט') || text.includes('תקשורת') || text.includes('סלולר') || text.includes('פלאפון')) {
      return 'תקשורת ואינטרנט'
    }
    if (text.includes('ביטוח') || company.includes('ביטוח')) {
      return 'ביטוח'
    }
    if (text.includes('רכב') || text.includes('דלק') || text.includes('חניה')) {
      return 'רכב ותחבורה'
    }
    if (text.includes('משרד') || text.includes('ציוד') || text.includes('מחשב')) {
      return 'ציוד משרדי'
    }
    if (text.includes('שכירות') || text.includes('דמי ניהול') || subject.includes('שכירות')) {
      return 'שכירות ודמי ניהול'
    }
    if (text.includes('יעוץ') || text.includes('שירות') || company.includes('יעוץ')) {
      return 'שירותים מקצועיים'
    }

    return 'כללי'
  }

  /**
   * זיהוי תקופה מהחשבוניות
   */
  detectPeriod(invoices) {
    const dates = invoices.map(inv => new Date(parseInt(inv.internalDate)))
      .filter(date => !isNaN(date.getTime()))
      .sort((a, b) => a - b)

    if (dates.length === 0) return null

    const firstDate = dates[0]
    const lastDate = dates[dates.length - 1]

    if (firstDate.getTime() === lastDate.getTime()) {
      return firstDate.toLocaleDateString('he-IL')
    }

    return `${firstDate.toLocaleDateString('he-IL')} - ${lastDate.toLocaleDateString('he-IL')}`
  }

  /**
   * יצירת קובץ CSV לייצוא
   */
  generateCSVExport(processedInvoices) {
    const headers = [
      'תאריך מייל',
      'שולח',
      'נושא',
      'קובץ',
      'שם חברה',
      'מספר חשבונית',
      'תאריך חשבונית',
      'סכום כולל',
      'מע"מ',
      'סכום לפני מע"מ',
      'קטגוריה',
      'סטטוס עיבוד'
    ]

    let csv = headers.join(',') + '\n'

    processedInvoices.forEach(invoice => {
      const emailDate = new Date(parseInt(invoice.internalDate)).toLocaleDateString('he-IL')
      
      if (invoice.processedData?.processedAttachments) {
        invoice.processedData.processedAttachments.forEach(att => {
          if (att.success) {
            const netAmount = (att.invoiceData?.totalAmount || 0) - (att.invoiceData?.taxAmount || 0)
            const category = this.categorizeInvoice(att, invoice)
            
            const row = [
              emailDate,
              `"${invoice.from || ''}"`,
              `"${invoice.subject || ''}"`,
              `"${att.filename || ''}"`,
              `"${att.invoiceData?.companyName || ''}"`,
              `"${att.invoiceData?.invoiceNumber || ''}"`,
              `"${att.invoiceData?.date || ''}"`,
              att.invoiceData?.totalAmount || 0,
              att.invoiceData?.taxAmount || 0,
              netAmount,
              `"${category}"`,
              'הצליח'
            ]
            csv += row.join(',') + '\n'
          } else {
            const row = [
              emailDate,
              `"${invoice.from || ''}"`,
              `"${invoice.subject || ''}"`,
              `"${att.filename || ''}"`,
              '', '', '', 0, 0, 0,
              'לא מסווג',
              `"שגיאה: ${att.error}"`
            ]
            csv += row.join(',') + '\n'
          }
        })
      }
    })

    return csv
  }
}

export default EmailGenerator 