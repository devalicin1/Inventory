import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom'
import { ExclamationTriangleIcon, HomeIcon } from '@heroicons/react/24/outline'

export function ErrorPage() {
  const error = useRouteError()
  
  let errorMessage = 'An unexpected error occurred'
  let errorStatus = 500

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status
    errorMessage = error.statusText || errorMessage
    
    if (error.status === 404) {
      errorMessage = 'Page not found'
    }
  } else if (error instanceof Error) {
    errorMessage = error.message
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {errorStatus === 404 ? 'Page Not Found' : 'Something went wrong'}
        </h1>
        <p className="text-gray-600 mb-2">
          {errorMessage}
        </p>
        {errorStatus === 404 && (
          <p className="text-sm text-gray-500 mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Reload Page
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <HomeIcon className="h-4 w-4 mr-2" />
            Go Home
          </Link>
        </div>
        {process.env.NODE_ENV === 'development' && error instanceof Error && (
          <details className="mt-6 text-left">
            <summary className="text-sm text-gray-500 cursor-pointer mb-2">
              Error Details (Development)
            </summary>
            <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-48">
              {error.stack || String(error)}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
