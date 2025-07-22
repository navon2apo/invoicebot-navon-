const { ipcRenderer, shell } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  // הזרקת כפתור צילום
  function injectCaptureButton() {
    const mainDiv = document.querySelector('div[role="main"]');
    if (!mainDiv || document.getElementById('invoicebot-capture-btn')) return;
    
    // כפתור צילום מושכל
    const btn = document.createElement('button');
    btn.id = 'invoicebot-capture-btn';
    btn.innerText = '📸 צלם חשבונית איכותית';
    btn.style.position = 'fixed';
    btn.style.top = '30px';
    btn.style.right = '40px';
    btn.style.zIndex = '99999';
    btn.style.background = 'linear-gradient(135deg, #1976d2, #1565c0)';
    btn.style.color = 'white';
    btn.style.fontSize = '16px';
    btn.style.padding = '12px 20px';
    btn.style.border = 'none';
    btn.style.borderRadius = '10px';
    btn.style.boxShadow = '0 4px 12px rgba(25,118,210,0.3)';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = 'bold';
    btn.style.transition = 'all 0.3s ease';
    btn.style.transform = 'scale(1)';
    
    // הוסף אפקטי hover
    btn.onmouseenter = () => {
      btn.style.transform = 'scale(1.05)';
      btn.style.boxShadow = '0 6px 16px rgba(25,118,210,0.4)';
    };
    btn.onmouseleave = () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 12px rgba(25,118,210,0.3)';
    };
    
    btn.onclick = () => {
      btn.disabled = true;
      btn.innerText = '⏳ מצלם באיכות גבוהה...';
      btn.style.background = '#424242';
      ipcRenderer.send('capture-mail-body-from-preview');
    };
    document.body.appendChild(btn);
    
    // כפתור עזר לפתיחת מייל במלואו
    const openBtn = document.createElement('button');
    openBtn.id = 'invoicebot-open-email-btn';
    openBtn.innerText = '📧 הרחב מייל מלא';
    openBtn.style.position = 'fixed';
    openBtn.style.top = '90px';
    openBtn.style.right = '40px';
    openBtn.style.zIndex = '99999';
    openBtn.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
    openBtn.style.color = 'white';
    openBtn.style.fontSize = '14px';
    openBtn.style.padding = '10px 16px';
    openBtn.style.border = 'none';
    openBtn.style.borderRadius = '8px';
    openBtn.style.boxShadow = '0 3px 10px rgba(255,152,0,0.3)';
    openBtn.style.cursor = 'pointer';
    openBtn.style.fontWeight = 'bold';
    openBtn.style.transition = 'all 0.3s ease';
    
    openBtn.onmouseenter = () => {
      openBtn.style.transform = 'scale(1.03)';
      openBtn.style.boxShadow = '0 4px 12px rgba(255,152,0,0.4)';
    };
    openBtn.onmouseleave = () => {
      openBtn.style.transform = 'scale(1)';
      openBtn.style.boxShadow = '0 3px 10px rgba(255,152,0,0.3)';
    };
    
    openBtn.onclick = () => {
      openBtn.disabled = true;
      openBtn.innerText = '⏳ מרחיב מייל...';
      openBtn.style.background = '#424242';
      tryOpenEmailManually();
      setTimeout(() => {
        openBtn.disabled = false;
        openBtn.innerText = '📧 הרחב מייל מלא';
        openBtn.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
      }, 4000);
    };
    document.body.appendChild(openBtn);
    
    // הודעת עזרה משופרת
    const helpDiv = document.createElement('div');
    helpDiv.id = 'invoicebot-help';
    helpDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">🎯 הוראות צילום:</div>
      <div style="font-size: 11px;">
        1️⃣ המתן שהמייל ייפתח מלא<br/>
        2️⃣ אם לא נפתח - לחץ "הרחב מייל מלא"<br/>
        3️⃣ לחץ "צלם חשבונית איכותית"
      </div>
    `;
    helpDiv.style.position = 'fixed';
    helpDiv.style.top = '150px';
    helpDiv.style.right = '40px';
    helpDiv.style.zIndex = '99999';
    helpDiv.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95))';
    helpDiv.style.color = '#333';
    helpDiv.style.fontSize = '12px';
    helpDiv.style.padding = '12px 16px';
    helpDiv.style.border = '2px solid #e3f2fd';
    helpDiv.style.borderRadius = '10px';
    helpDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    helpDiv.style.maxWidth = '220px';
    helpDiv.style.lineHeight = '1.4';
    helpDiv.style.backdropFilter = 'blur(10px)';
    document.body.appendChild(helpDiv);
    
    // הסתר הודעת עזרה אחרי 15 שניות
    setTimeout(() => {
      if (helpDiv.parentNode) {
        helpDiv.style.opacity = '0';
        helpDiv.style.transition = 'opacity 0.8s ease';
        setTimeout(() => helpDiv.remove(), 800);
      }
    }, 15000);
  }
  
  // פונקציה ידנית משופרת לפתיחת מייל
  function tryOpenEmailManually() {
    console.log('פתיחה ידנית משופרת של מייל...');
    
    // אסטרטגיות לפתיחת המייל
    const strategies = [
      () => {
        const messageRows = document.querySelectorAll('tr[role="row"]:not([aria-selected="true"])');
        if (messageRows.length > 0) {
          messageRows[0].click();
          return true;
        }
        return false;
      },
      () => {
        const listItems = document.querySelectorAll('[role="listitem"]:not([aria-selected="true"])');
        if (listItems.length > 0) {
          listItems[0].click();
          return true;
        }
        return false;
      },
      () => {
        const mailDivs = document.querySelectorAll('div[data-legacy-thread-id]');
        if (mailDivs.length > 0) {
          mailDivs[0].click();
          return true;
        }
        return false;
      },
      () => {
        const allClickables = document.querySelectorAll('[data-thread-id], [data-message-id], .zA');
        if (allClickables.length > 0) {
          allClickables[0].click();
          return true;
        }
        return false;
      }
    ];
    
    let emailOpened = false;
    for (let i = 0; i < strategies.length; i++) {
      if (strategies[i]()) {
        console.log(`אסטרטגיה ${i + 1} הצליחה`);
        emailOpened = true;
        break;
      }
    }
    
    if (emailOpened) {
      // אחרי פתיחת המייל, נסה להרחיב אותו
      setTimeout(() => {
        expandEmailFully();
        console.log('מייל נפתח ומורחב ידנית');
      }, 2000);
    } else {
      console.log('לא הצלחתי לפתוח מייל ידנית');
    }
    
    // פונקציה פנימית להרחבת המייל (משותפת עם הפונקציה האוטומטית)
    function expandEmailFully() {
      console.log('הרחבה ידנית של המייל...');
      
      // כפתורי הרחבה
      const expandButtons = [
        ...document.querySelectorAll('[aria-label*="Show"], [aria-label*="More"], [title*="Show"]'),
        ...document.querySelectorAll('.aaq, .amn, .bog'),
        ...document.querySelectorAll('[data-action="expand"]'),
      ];
      
      expandButtons.forEach(btn => {
        if (btn && btn.textContent && 
            (btn.textContent.includes('Show') || 
             btn.textContent.includes('הצג') || 
             btn.textContent.includes('More') ||
             btn.textContent.includes('עוד'))) {
          console.log('לוחץ ידנית על כפתור הרחבה:', btn.textContent);
          btn.click();
        }
      });
      
      // וודא מיקום טוב לצילום
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 500);
    }
  }
  
  // פונקציה מושכלת לפתיחה מלאה של המייל
  function autoOpenEmail() {
    console.log('מנסה לפתוח מייל אוטומטית במלואו...');
    
    let attempts = 0;
    const maxAttempts = 15;
    
    function tryOpenEmailFully() {
      attempts++;
      console.log(`ניסיון ${attempts} לפתיחת מייל...`);
      
      // שלב 1: חפש ופתח את המייל
      const messageRows = document.querySelectorAll('tr[role="row"]:not([aria-selected="true"])');
      const listItems = document.querySelectorAll('[role="listitem"]:not([aria-selected="true"])');
      const mailDivs = document.querySelectorAll('div[data-legacy-thread-id]');
      
      let emailOpened = false;
      
      if (messageRows.length > 0) {
        console.log('פותח מייל מרשימת שורות...');
        messageRows[0].click();
        emailOpened = true;
      } else if (listItems.length > 0) {
        console.log('פותח מייל מרשימת פריטים...');
        listItems[0].click();
        emailOpened = true;
      } else if (mailDivs.length > 0) {
        console.log('פותח מייל מדיבי מיילים...');
        mailDivs[0].click();
        emailOpened = true;
      }
      
      if (emailOpened) {
        // שלב 2: המתן ונסה להרחיב את המייל למלואו
        setTimeout(() => {
          expandEmailFully();
          
          // בדוק אם המייל נפתח במלואו
          setTimeout(() => {
            const mailContent = document.querySelector('[role="main"] [data-message-id]');
            const expandedContent = document.querySelector('[data-message-id] .ii.gt div');
            
            if (mailContent || expandedContent) {
              console.log('המייל נפתח בהצלחה ומורחב!');
              // נסה להרחיב עוד יותר אם יש אפשרות
              expandEmailFully();
            } else if (attempts < maxAttempts) {
              setTimeout(tryOpenEmailFully, 1500);
            }
          }, 3000);
        }, 2000);
      } else if (attempts < maxAttempts) {
        console.log('לא נמצא מייל, מנסה שוב...');
        setTimeout(tryOpenEmailFully, 2000);
      } else {
        console.log('נכשל לפתוח מייל אחרי ' + maxAttempts + ' ניסיונות');
      }
    }
    
    // פונקציה להרחבת המייל למלואו
    function expandEmailFully() {
      console.log('מנסה להרחיב את המייל למלואו...');
      
      // חפש כפתורי הרחבה שונים
      const expandButtons = [
        // כפתור "הצג עוד" או "..." 
        ...document.querySelectorAll('[aria-label*="Show"], [aria-label*="More"], [title*="Show"]'),
        // כפתורי קיצור כלליים
        ...document.querySelectorAll('.aaq, .amn, .bog'),
        // כפתורי הרחבה של תוכן
        ...document.querySelectorAll('[data-action="expand"]'),
        // כפתורי "הצג תמונות"
        ...document.querySelectorAll('[role="button"]:not([aria-hidden="true"])'),
      ];
      
      expandButtons.forEach(btn => {
        if (btn && btn.textContent && 
            (btn.textContent.includes('Show') || 
             btn.textContent.includes('הצג') || 
             btn.textContent.includes('More') ||
             btn.textContent.includes('עוד'))) {
          console.log('לוחץ על כפתור הרחבה:', btn.textContent);
          btn.click();
        }
      });
      
      // הרחב תמונות אם יש
      const imageButtons = document.querySelectorAll('[aria-label*="image"], [aria-label*="תמונה"]');
      imageButtons.forEach(btn => btn.click());
      
      // וודא שהמייל מלא נראה
      setTimeout(() => {
        // גלול מעט למעלה כדי לוודא שהחלק העליון נראה
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // נסה להסיר הודעות מטרידות
        const notifications = document.querySelectorAll('[role="alert"], .b8.UC .vh');
        notifications.forEach(notif => {
          if (notif.textContent && notif.textContent.includes('show')) {
            notif.style.display = 'none';
          }
        });
      }, 1000);
    }
    
    // התחל אחרי טעינת הדף
    setTimeout(tryOpenEmailFully, 3000);
  }
  
  setTimeout(injectCaptureButton, 1500); // תן ל-Gmail להיטען
  setTimeout(autoOpenEmail, 2000); // התחל לנסות לפתוח מייל
});

// תמיכה ב-request-capture-mail-body (לשימוש קודם)
ipcRenderer.on('request-capture-mail-body', () => {
  const mainDiv = document.querySelector('div[role="main"]');
  if (mainDiv) {
    const rect = mainDiv.getBoundingClientRect();
    ipcRenderer.send('mail-body-rect', {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    });
  } else {
    ipcRenderer.send('mail-body-rect', null);
  }
});

// פידבק אחרי צילום
ipcRenderer.on('mailbody-capture-result', (event, { filePath, error }) => {
  const btn = document.getElementById('invoicebot-capture-btn');
  if (btn) {
    btn.disabled = false;
    btn.innerText = '📸 צילום חשבונית';
  }
  showCapturePopup(filePath, error);
});

function showCapturePopup(filePath, error) {
  removeCapturePopup();
  const popup = document.createElement('div');
  popup.id = 'invoicebot-capture-popup';
  popup.style.position = 'fixed';
  popup.style.top = '80px';
  popup.style.right = '40px';
  popup.style.zIndex = '99999';
  popup.style.background = '#fff';
  popup.style.border = '2px solid #1976d2';
  popup.style.borderRadius = '10px';
  popup.style.boxShadow = '0 2px 12px rgba(0,0,0,0.18)';
  popup.style.padding = '18px 22px';
  popup.style.fontSize = '15px';
  popup.style.color = '#222';
  popup.style.display = 'flex';
  popup.style.flexDirection = 'column';
  popup.style.alignItems = 'flex-start';
  popup.style.gap = '10px';
  if (error) {
    popup.innerHTML = `<b style='color:red'>❌ שגיאה בצילום:</b><br>${error}`;
  } else {
    popup.innerHTML = `<b style='color:#1976d2'>✔️ נשמר צילום!</b><br><span style='font-size:13px;word-break:break-all'>${filePath}</span>`;
    const openBtn = document.createElement('button');
    openBtn.innerText = 'פתח תיקייה';
    openBtn.style.background = '#1976d2';
    openBtn.style.color = 'white';
    openBtn.style.border = 'none';
    openBtn.style.borderRadius = '6px';
    openBtn.style.padding = '6px 14px';
    openBtn.style.fontSize = '14px';
    openBtn.style.cursor = 'pointer';
    openBtn.onclick = () => {
      ipcRenderer.send('open-external-folder', filePath);
    };
    popup.appendChild(openBtn);
  }
  const closeBtn = document.createElement('button');
  closeBtn.innerText = 'סגור';
  closeBtn.style.background = '#eee';
  closeBtn.style.color = '#333';
  closeBtn.style.border = 'none';
  closeBtn.style.borderRadius = '6px';
  closeBtn.style.padding = '6px 14px';
  closeBtn.style.fontSize = '14px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = removeCapturePopup;
  popup.appendChild(closeBtn);
  document.body.appendChild(popup);
}
function removeCapturePopup() {
  const old = document.getElementById('invoicebot-capture-popup');
  if (old) old.remove();
} 