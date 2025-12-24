import { useState, useEffect } from 'react'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface PasswordStrengthIndicatorProps {
  password: string
  showStrength?: boolean
}

export function PasswordStrengthIndicator({ password, showStrength = true }: PasswordStrengthIndicatorProps) {
  const [strength, setStrength] = useState<{
    score: number
    label: string
    color: string
    checks: Array<{ label: string; passed: boolean }>
  }>({
    score: 0,
    label: '',
    color: '',
    checks: []
  })

  useEffect(() => {
    if (!password) {
      setStrength({
        score: 0,
        label: '',
        color: '',
        checks: []
      })
      return
    }

    const checks = [
      { label: 'At least 6 characters', passed: password.length >= 6 },
      { label: 'At least 8 characters', passed: password.length >= 8 },
      { label: 'Contains uppercase letter', passed: /[A-Z]/.test(password) },
      { label: 'Contains lowercase letter', passed: /[a-z]/.test(password) },
      { label: 'Contains number', passed: /[0-9]/.test(password) },
      { label: 'Contains special character', passed: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ]

    const passedChecks = checks.filter(c => c.passed).length
    let score = 0
    let label = ''
    let color = ''

    if (passedChecks <= 2) {
      score = 1
      label = 'Weak'
      color = 'red'
    } else if (passedChecks <= 4) {
      score = 2
      label = 'Fair'
      color = 'yellow'
    } else if (passedChecks <= 5) {
      score = 3
      label = 'Good'
      color = 'blue'
    } else {
      score = 4
      label = 'Strong'
      color = 'green'
    }

    setStrength({ score, label, color, checks })
  }, [password])

  if (!showStrength || !password) {
    return null
  }

  const colorClasses = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
  }

  const textColors = {
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Strength Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${colorClasses[strength.color as keyof typeof colorClasses]}`}
            style={{ width: `${(strength.score / 4) * 100}%` }}
          />
        </div>
        {strength.label && (
          <span className={`text-xs font-medium ${textColors[strength.color as keyof typeof textColors]}`}>
            {strength.label}
          </span>
        )}
      </div>

      {/* Requirements List */}
      {password.length > 0 && (
        <div className="space-y-1">
          {strength.checks.slice(0, 4).map((check, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              {check.passed ? (
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
              ) : (
                <XCircleIcon className="h-4 w-4 text-gray-300" />
              )}
              <span className={check.passed ? 'text-green-600' : 'text-gray-500'}>
                {check.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
