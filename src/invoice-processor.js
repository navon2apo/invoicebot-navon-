import Tesseract from 'tesseract.js'

/**
 * Invoice Processor - מעבד חשבוניות
 * מטפל בחילוץ טקסט מ-PDF, OCR לתמונות, וניתוח נתונים
 */
export class InvoiceProcessor {
  constructor() {
    this.supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp']
    this.supportedDocTypes = ['application/pdf']
  }

  /**
   * עיבוד חשבונית מקובץ מצורף
   */
  async processInvoiceFile(file, fileBuffer) {
    try {
      console.log(`Processing file: ${file.filename}, type: ${file.mimeType}`)

      let extractedText = ''
      let processingMethod = ''

      // זיהוי סוג הקובץ ועיבוד בהתאם
      if (this.supportedDocTypes.includes(file.mimeType)) {
        // עיבוד PDF
        extractedText = await this.extractTextFromPDF(fileBuffer)
        processingMethod = 'PDF_EXTRACT'
      } else if (this.supportedImageTypes.includes(file.mimeType)) {
        // עיבוד תמונה באמצעות OCR
        extractedText = await this.extractTextFromImage(fileBuffer)
        processingMethod = 'OCR'
      } else {
        throw new Error(`Unsupported file type: ${file.mimeType}`)
      }

      // ניתוח הטקסט ושליפת נתונים
      const invoiceData = await this.extractInvoiceData(extractedText)

      return {
        success: true,
        data: {
          fileName: file.filename,
          mimeType: file.mimeType,
          processingMethod,
          extractedText,
          invoiceData,
          processedAt: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('Error processing invoice file:', error)
      return {
        success: false,
        error: error.message,
        fileName: file.filename
      }
    }
  }

  /**
   * חילוץ טקסט מקובץ PDF
   */
  async extractTextFromPDF(fileBuffer) {
    try {
      // Note: In a real Electron app, we would use pdf-parse
      // For now, we'll simulate this functionality
      console.log('Extracting text from PDF...')
      
      // This would be the actual implementation:
      // const pdfParse = require('pdf-parse')
      // const data = await pdfParse(fileBuffer)
      // return data.text
      
      // Simulated response for development
      await new Promise(resolve => setTimeout(resolve, 1000))
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
סה"כ לתשלום: 117 ש"ח`
    } catch (error) {
      throw new Error(`PDF processing failed: ${error.message}`)
    }
  }

  /**
   * חילוץ טקסט מתמונה באמצעות OCR
   */
  async extractTextFromImage(imageBuffer) {
    try {
      console.log('Performing OCR on image...')
      
      const { data: { text } } = await Tesseract.recognize(
        imageBuffer,
        'heb+eng', // תמיכה בעברית ואנגלית
        {
          logger: m => console.log(m) // לוג התקדמות
        }
      )
      
      return text
    } catch (error) {
      throw new Error(`OCR processing failed: ${error.message}`)
    }
  }

  /**
   * ניתוח טקסט ושליפת נתוני חשבונית מובנים
   */
  async extractInvoiceData(text) {
    try {
      console.log('Analyzing invoice text for structured data...')
      
      const invoiceData = {
        companyName: this.extractCompanyName(text),
        companyId: this.extractCompanyId(text),
        invoiceNumber: this.extractInvoiceNumber(text),
        date: this.extractDate(text),
        totalAmount: this.extractTotalAmount(text),
        taxAmount: this.extractTaxAmount(text),
        items: this.extractItems(text),
        customerInfo: this.extractCustomerInfo(text)
      }

      // בדיקת תקינות נתונים בסיסיים
      this.validateInvoiceData(invoiceData)

      return invoiceData
    } catch (error) {
      throw new Error(`Data extraction failed: ${error.message}`)
    }
  }

  /**
   * חילוץ שם החברה
   */
  extractCompanyName(text) {
    // דפוסים נפוצים לשם חברה
    const patterns = [
      /(?:חברה|חברת|ח\.פ\.?|מ\.ח\.ח\.?|שם העסק)[:\s]+(.+?)(?:\n|ח\.פ|מ\.ח\.ח|$)/i,
      /^(.+?)(?:בע"מ|בע"מ|ושות'|ושותפים|עמותה)/im,
      /(?:מאת|אצל|שם)[:\s]+(.+?)(?:\n|$)/i
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }
    return null
  }

  /**
   * חילוץ מספר חברה/ח.פ
   */
  extractCompanyId(text) {
    const patterns = [
      /(?:ח\.פ\.?|ח"פ|מ\.ח\.ח\.?|עוסק מורשה)[:\s#]*(\d{9})/i,
      /(?:company|registration|tax)[:\s]*(\d{9})/i
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    return null
  }

  /**
   * חילוץ מספר חשבונית
   */
  extractInvoiceNumber(text) {
    const patterns = [
      /(?:חשבונית|מספר חשבונית|invoice|inv)[:\s#]*([A-Z0-9\-_]+)/i,
      /(?:מס'|מספר)[:\s]*(\d+)/i
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }
    return null
  }

  /**
   * חילוץ תאריך
   */
  extractDate(text) {
    const patterns = [
      /(?:תאריך|date)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/g
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        try {
          const date = new Date(match[1].replace(/[\.]/g, '/'))
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]
          }
        } catch (e) {
          continue
        }
      }
    }
    return null
  }

  /**
   * חילוץ סכום כולל
   */
  extractTotalAmount(text) {
    const patterns = [
      /(?:סה"כ|סכום כולל|total|סה״כ)[:\s]*([0-9,]+\.?\d*)[:\s]*(?:ש"ח|₪|ils|shekel)/i,
      /(?:לתשלום|לחיוב)[:\s]*([0-9,]+\.?\d*)[:\s]*(?:ש"ח|₪)/i,
      /([0-9,]+\.?\d*)[:\s]*(?:ש"ח|₪)(?:\s*$|\s*\n)/i
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const amount = parseFloat(match[1].replace(/,/g, ''))
        if (!isNaN(amount)) {
          return amount
        }
      }
    }
    return null
  }

  /**
   * חילוץ סכום מע"מ
   */
  extractTaxAmount(text) {
    const patterns = [
      /(?:מע"מ|מע״מ|vat|tax)[:\s]*([0-9,]+\.?\d*)[:\s]*(?:ש"ח|₪|%)/i
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const amount = parseFloat(match[1].replace(/,/g, ''))
        if (!isNaN(amount)) {
          return amount
        }
      }
    }
    return null
  }

  /**
   * חילוץ פריטים
   */
  extractItems(text) {
    // זיהוי פריטים בחשבונית - זה מורכב יותר וייתכן שיידרש AI
    const items = []
    const lines = text.split('\n')
    
    for (const line of lines) {
      // חיפוש שורות שנראות כמו פריטים
      const itemMatch = line.match(/(.+?)\s+(\d+\.?\d*)\s*(?:ש"ח|₪)/)
      if (itemMatch) {
        items.push({
          description: itemMatch[1].trim(),
          amount: parseFloat(itemMatch[2])
        })
      }
    }
    
    return items
  }

  /**
   * חילוץ פרטי לקוח
   */
  extractCustomerInfo(text) {
    const customerInfo = {}
    
    // חיפוש פרטי לקוח
    const customerPatterns = [
      /(?:לכבוד|לקוח|customer)[:\s]+(.+?)(?:\n|$)/i,
      /(?:כתובת|address)[:\s]+(.+?)(?:\n|$)/i
    ]

    for (const pattern of customerPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        customerInfo.name = match[1].trim()
        break
      }
    }

    return customerInfo
  }

  /**
   * בדיקת תקינות נתוני חשבונית
   */
  validateInvoiceData(data) {
    const errors = []

    if (!data.companyName) {
      errors.push('לא נמצא שם חברה')
    }

    if (!data.totalAmount || data.totalAmount <= 0) {
      errors.push('לא נמצא סכום תקין')
    }

    if (!data.date) {
      errors.push('לא נמצא תאריך')
    }

    if (errors.length > 0) {
      console.warn('Invoice validation warnings:', errors)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * יצירת סיכום חשבונית
   */
  generateInvoiceSummary(invoiceData) {
    return {
      company: invoiceData.companyName || 'לא זוהה',
      amount: invoiceData.totalAmount || 0,
      date: invoiceData.date || 'לא זוהה',
      invoiceNumber: invoiceData.invoiceNumber || 'לא זוהה',
      hasVAT: !!invoiceData.taxAmount,
      itemCount: invoiceData.items?.length || 0
    }
  }
}

export default InvoiceProcessor 