import { useState } from 'react'

function Toolbar({ 
  isAuthenticated, 
  isLoading, 
  onGoogleAuth, 
  onGoogleLogout, 
  onScanEmails, 
  onTestElectron 
}) {
  return (
    <div className="sticky top-0 z-40 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900 shadow-xl border-b border-slate-600/30">
      <div className="container mx-auto px-4 py-3">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-white mb-1 tracking-wide flex items-center justify-center gap-2">
            <span className="text-3xl">🤖</span>
            InvoiceBot
          </h1>
          <p className="text-base text-slate-300 font-medium">
            מערכת אוטומטית לאיסוף וניהול חשבוניות מ-Gmail
          </p>
        </div>

        {/* Main Control Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={onGoogleAuth}
            disabled={isLoading || isAuthenticated}
            className={`px-6 py-3 rounded-xl font-semibold text-base transition-all duration-300 transform ${
              isAuthenticated 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg scale-105 cursor-default' 
                : 'bg-gradient-to-r from-white to-slate-50 text-slate-700 hover:from-slate-50 hover:to-white hover:scale-105 hover:shadow-xl border border-slate-200'
            } disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none`}
          >
            {isAuthenticated ? '✅ מחובר ל-Google' : '🔐 התחבר ל-Google'}
          </button>

          {isAuthenticated && (
            <button
              onClick={onGoogleLogout}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white rounded-xl font-semibold text-base transition-all duration-300 transform hover:scale-105 hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              🔓 התנתק מ-Google
            </button>
          )}

          <button
            onClick={onScanEmails}
            disabled={isLoading || !isAuthenticated}
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-semibold text-base transition-all duration-300 transform hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            🔍 סרוק מיילים
          </button>

          <button
            onClick={onTestElectron}
            disabled={isLoading}
            className="px-6 py-3 bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white rounded-xl font-semibold text-base transition-all duration-300 transform hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            🔗 בדיקת Electron
          </button>
        </div>
      </div>
    </div>
  )
}

export default Toolbar 