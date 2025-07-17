# 📋 יומן פיתוח - InvoiceBot Electron App

## 🎯 מטרת הפרויקט
אפליקציית Electron לאיסוף וניהול חשבוניות אוטומטי מ-Gmail, כולל OAuth, סריקת מיילים, עיבוד PDF ו-OCR.

---

## 🛠️ הגדרות הפרויקט שעובדות

### התקנות נדרשות:
```bash
npm install
```

### הרצת האפליקציה:
```bash
# אופציה 1: הרצה משולבת (אחרי תיקון כל הגדרות ה-port)
npm run dev

# אופציה 2: הרצה נפרדת (מה שעובד כרגע)
# Terminal 1:
npm run dev:react

# Terminal 2:
$env:NODE_ENV="development"; .\node_modules\.bin\electron.cmd .
```

---

## 🔧 תיקונים שבוצעו

### 1. בעיית OAuth - שדרוג לשיטה מתקדמת ✅
**הבעיה**: OAuth ידני עם העתקת קוד - חוויית משתמש גרועה

**הפתרון**:
- שדרוג מ-Desktop Application ל-Web Application OAuth
- יצירת Local HTTP Server אוטומטי
- הפניה אוטומטית לדפדפן
- קבלת קוד אוטומטית ב-callback

**קבצים שעודכנו**:
- `src/google-auth.js` - מערכת OAuth מתקדמת
- `google-credentials.json` - credentials חדשים

### 2. הוספת פילטר תאריכים ✅
**הבעיה**: סריקת כל המיילים ללא הגבלת זמן

**הפתרון**:
- הוספת UI לבחירת טווח תאריכים
- מימוש Gmail API עם `after:` ו-`before:`
- העלאת maxResults ל-200

**קבצים שעודכנו**:
- `src/App.jsx` - הוספת date pickers
- `src/google-auth.js` - פונקציית `searchInvoicesWithDateFilter`

### 3. תיקון בעיות Electron ✅
**הבעיה הראשית**: האפליקציה השולחנית לא עלתה

**גורמי הבעיה**:
1. **Port Mismatch**: Vite רץ על 5174, Electron חיפש 5173
2. **cross-env לא זמין**: המערכת לא הכירה את הפקודה
3. **נתיב Electron**: לא מצא את electron כפקודה גלובלית

**הפתרונות**:
```javascript
// electron.js - תיקון port
if (isDev) {
  mainWindow.loadURL('http://localhost:5174'); // הוחלף מ-5173
}
```

```json
// package.json - תיקון פקודות
"dev:electron": "cross-env NODE_ENV=development wait-on tcp:5174 && electron ."
```

```powershell
# הפקודה שעובדת לVindows
$env:NODE_ENV="development"; .\node_modules\.bin\electron.cmd .
```

### 4. תיקון CSS/Tailwind ✅
**הבעיה**: שגיאות PostCSS מונעות טעינת האפליקציה

**הפתרון**:
- השבתה זמנית של Tailwind ב-`postcss.config.js`
- הוספת CSS בסיסי ב-`src/index.css`

---

## 📂 מבנה הפרויקט

```
invoice-bot/
├── electron.js              # תהליך ראשי של Electron
├── preload.js              # IPC bridge בין renderer למain
├── package.json            # הגדרות פרויקט ופקודות
├── google-credentials.json # OAuth credentials
├── src/
│   ├── App.jsx            # רכיב ראשי עם UI
│   ├── google-auth.js     # מערכת אימות Google
│   ├── invoice-processor.js # עיבוד PDF ו-OCR
│   ├── email-generator.js  # יצירת מיילי סיכום
│   └── index.css          # סטיילינג בסיסי
└── DEVELOPMENT_LOG.md      # קובץ זה
```

---

## 🔍 פתרון בעיות נפוצות

### חלון Electron לא נפתח
```bash
# בדוק שהפקודות האלה עובדות:
npm run dev:react  # אמור לרוץ על localhost:5174
$env:NODE_ENV="development"; .\node_modules\.bin\electron.cmd .
```

### שגיאות PostCSS/Tailwind
- וודא ש-Tailwind מושבת ב-`postcss.config.js`
- השתמש בCSS בסיסי ב-`src/index.css`

### שגיאות OAuth
- וודא שיש `google-credentials.json` תקין
- בדוק שה-redirect URI מוגדר ל-`http://localhost:3000/callback`

---

## 🚀 השלבים הבאים
1. ✅ **OAuth עובד** - וידוא שההתחברות לGoogle פועלת
2. ✅ **סריקת מיילים עם תאריכים** - בדיקת פילטר התאריכים
3. ⏳ **עיבוד PDF** - בדיקת מערכת OCR ו-PDF parsing
4. ⏳ **יצירת דוחות** - בדיקת מערכת EmailGenerator
5. ⏳ **שיפור UI** - החזרת Tailwind וסטיילינג מתקדם

---

## 💾 נקודת שחזור
**תאריך**: 17/07/2024
**מצב**: האפליקציה השולחנית עולה בהצלחה
**פקודה לבדיקה**: `$env:NODE_ENV="development"; .\node_modules\.bin\electron.cmd .`
**גרסאות**: Node.js, Electron, React 19, Vite 7

---

## 📝 הערות טכניות
- המערכת פועלת על Windows 10
- נדרש PowerShell להרצת הפקודות
- יש להתקין cross-env גלובלית או להשתמש בפקודות PowerShell
- port 5174 הוא ברירת המחדל כרגע (5173 תפוס)

---

## 🔄 עדכונים עתידיים
- [ ] החזרת Tailwind CSS לאחר סיום פיתוח הליבה
- [ ] הוספת מערכת בדיקות (tests)
- [ ] אופטימיזציה לביצועים
- [ ] הכנה לפרסום (build & distribution) 