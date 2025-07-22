import { useState, useEffect } from 'react'

function ToastManager({ status, isLoading }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (status) {
      setIsVisible(true)
      // Hide toast after 5 seconds if not loading
      if (!isLoading) {
        const timer = setTimeout(() => {
          setIsVisible(false)
        }, 5000)
        return () => clearTimeout(timer)
      }
    }
  }, [status, isLoading])

  useEffect(() => {
    if (!isLoading) {
      // Keep showing for 2 more seconds after loading stops
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  if (!status || !isVisible) return null

  const getStatusColor = () => {
    if (status.includes('❌')) return 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200'
    if (status.includes('✅')) return 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200'
    if (status.includes('🔍') || status.includes('🔄')) return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200'
    return 'bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-gray-200'
  }

  return (
    <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 max-w-lg w-full mx-4">
      <div className={`rounded-2xl p-5 shadow-2xl transition-all duration-500 transform ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} ${getStatusColor()}`}>
        <div className="flex items-center gap-4">
          {isLoading && (
            <div className="flex-shrink-0">
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <span className="text-base font-semibold flex-1">
            {status || 'מוכן לעבודה...'}
          </span>
          <button
            onClick={() => setIsVisible(false)}
            className="flex-shrink-0 w-8 h-8 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center transition-all duration-200 text-white font-bold"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// Create a global toast function for easy access
let globalToastSetter = null

export const setGlobalToast = (message) => {
  if (globalToastSetter) {
    globalToastSetter(message)
  }
}

export const GlobalToastProvider = ({ children }) => {
  const [globalStatus, setGlobalStatus] = useState('')
  const [globalLoading, setGlobalLoading] = useState(false)

  // Register global setter
  useEffect(() => {
    globalToastSetter = (message) => {
      setGlobalStatus(message)
      setGlobalLoading(message.includes('🔍') || message.includes('🔄'))
    }
    
    return () => {
      globalToastSetter = null
    }
  }, [])

  return (
    <>
      {children}
      <ToastManager status={globalStatus} isLoading={globalLoading} />
    </>
  )
}

export default ToastManager 