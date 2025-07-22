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
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🤖 InvoiceBot
          </h1>
          <p className="text-lg text-gray-600">
            מערכת אוטומטית לאיסוף וניהול חשבוניות מ-Gmail
          </p>
          <div className="mt-2 text-red-600 font-bold text-lg">
            גרסה: 2024-07-20 בדיקת קוד חי
          </div>
        </div>

        {/* Main Control Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={onGoogleAuth}
            disabled={isLoading || isAuthenticated}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              isAuthenticated 
                ? 'bg-green-500 text-white cursor-default' 
                : 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isAuthenticated ? '✅ מחובר ל-Google' : '🔐 התחבר ל-Google'}
          </button>

          {isAuthenticated && (
            <button
              onClick={onGoogleLogout}
              disabled={isLoading}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🔓 התנתק מ-Google
            </button>
          )}

          <button
            onClick={onScanEmails}
            disabled={isLoading || !isAuthenticated}
            className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔍 סרוק מיילים
          </button>

          <button
            onClick={onTestElectron}
            disabled={isLoading}
            className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔗 בדיקת Electron
          </button>
        </div>
      </div>
    </div>
  )
}

export default Toolbar 