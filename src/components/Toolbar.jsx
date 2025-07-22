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
    <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 shadow-2xl">
      <div className="container mx-auto px-6 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white mb-3 tracking-wide">
            🤖 InvoiceBot
          </h1>
          <p className="text-xl text-blue-100 font-medium">
            מערכת אוטומטית לאיסוף וניהול חשבוניות מ-Gmail
          </p>
          <div className="mt-3 text-yellow-300 font-bold text-lg animate-pulse">
            גרסה: 2024-07-20 בדיקת קוד חי
          </div>
        </div>

        {/* Main Control Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <button
            onClick={onGoogleAuth}
            disabled={isLoading || isAuthenticated}
            className={`px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform ${
              isAuthenticated 
                ? 'bg-gradient-to-r from-green-400 to-green-600 text-white shadow-lg scale-105 animate-pulse cursor-default' 
                : 'bg-gradient-to-r from-white to-blue-50 text-blue-700 hover:from-blue-50 hover:to-white hover:scale-105 hover:shadow-2xl border-2 border-white'
            } disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none`}
          >
            {isAuthenticated ? '✅ מחובר ל-Google' : '🔐 התחבר ל-Google'}
          </button>

          {isAuthenticated && (
            <button
              onClick={onGoogleLogout}
              disabled={isLoading}
              className="px-8 py-4 bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              🔓 התנתק מ-Google
            </button>
          )}

          <button
            onClick={onScanEmails}
            disabled={isLoading || !isAuthenticated}
            className="px-8 py-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            🔍 סרוק מיילים
          </button>

          <button
            onClick={onTestElectron}
            disabled={isLoading}
            className="px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-800 hover:from-gray-700 hover:to-gray-900 text-white rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            🔗 בדיקת Electron
          </button>
        </div>
      </div>
    </div>
  )
}

export default Toolbar 