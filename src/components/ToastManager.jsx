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
    if (status.includes('❌')) return 'bg-red-50 border-red-200 text-red-700'
    if (status.includes('✅')) return 'bg-green-50 border-green-200 text-green-700'
    if (status.includes('🔍') || status.includes('🔄')) return 'bg-blue-50 border-blue-200 text-blue-700'
    return 'bg-gray-50 border-gray-200 text-gray-700'
  }

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
      <div className={`rounded-lg p-4 border shadow-lg transition-all duration-300 ${getStatusColor()}`}>
        <div className="flex items-center gap-3">
          {isLoading && (
            <div className="flex-shrink-0">
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <span className="text-sm font-medium flex-1">
            {status || 'מוכן לעבודה...'}
          </span>
          <button
            onClick={() => setIsVisible(false)}
            className="flex-shrink-0 text-current hover:opacity-70 transition-opacity"
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