import { Link } from 'react-router-dom'
import { 
  CubeIcon, 
  CogIcon, 
  ChartBarIcon,
  DocumentTextIcon,
  QrCodeIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  PlayIcon
} from '@heroicons/react/24/outline'
import { LOGO_URL } from '../utils/logo'

export function Landing() {
  const features = [
    {
      icon: CubeIcon,
      title: 'Inventory Management',
      description: 'Track products, stock levels, and locations in real-time. Get low stock alerts and manage your entire inventory from one place.',
      color: 'blue'
    },
    {
      icon: CogIcon,
      title: 'Production Tracking',
      description: 'Monitor production jobs, workflows, and work centers. Track progress through each stage with real-time updates.',
      color: 'purple'
    },
    {
      icon: DocumentTextIcon,
      title: 'Purchase Orders',
      description: 'Create and manage purchase orders with PDF generation. Track vendor relationships and streamline procurement.',
      color: 'green'
    },
    {
      icon: ChartBarIcon,
      title: 'Reports & Analytics',
      description: 'Comprehensive reports on inventory value, production performance, and business insights to make data-driven decisions.',
      color: 'orange'
    },
    {
      icon: QrCodeIcon,
      title: 'Barcode Scanning',
      description: 'Scan barcodes and QR codes to quickly update inventory, track production, and manage stock transactions.',
      color: 'indigo'
    },
    {
      icon: BuildingOfficeIcon,
      title: 'QuickBooks Integration',
      description: 'Seamlessly sync products, inventory, and invoices with QuickBooks for complete financial management.',
      color: 'teal'
    }
  ]

  const benefits = [
    'Real-time inventory tracking',
    'Multi-workspace support',
    'Role-based access control',
    'Mobile-friendly interface',
    'Automated low stock alerts',
    'Production workflow management'
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img
                src={LOGO_URL}
                alt="Itory logo"
                className="h-8 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/login"
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-sm hover:shadow"
              >
                Get Started
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 sm:pt-24 sm:pb-20">
          <div className="text-center">
            <div className="inline-flex items-center justify-center mb-6">
              <img
                src={LOGO_URL}
                alt="Itory logo"
                className="h-16 w-auto object-contain"
              />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Operational Clarity &<br />
              <span className="text-blue-600">Real-Time Control</span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto mb-8">
              Complete inventory and production management system. Track stock, manage production, and gain insights—all in one platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/login"
                className="inline-flex items-center px-8 py-4 border border-transparent text-base font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Start Free Trial
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
              <button className="inline-flex items-center px-8 py-4 border border-gray-300 text-base font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all">
                <PlayIcon className="mr-2 h-5 w-5" />
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Manage Operations
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Powerful features designed to streamline your inventory and production workflows
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              const colorClasses = {
                blue: 'bg-blue-100 text-blue-600',
                purple: 'bg-purple-100 text-purple-600',
                green: 'bg-green-100 text-green-600',
                orange: 'bg-orange-100 text-orange-600',
                indigo: 'bg-indigo-100 text-indigo-600',
                teal: 'bg-teal-100 text-teal-600'
              }
              
              return (
                <div
                  key={index}
                  className="relative p-6 rounded-xl border border-gray-200 bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className={`inline-flex p-3 rounded-lg ${colorClasses[feature.color as keyof typeof colorClasses] || colorClasses.blue} mb-4`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                Why Choose Itory?
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Built for modern businesses that need real-time visibility and control over their operations.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircleIcon className="h-6 w-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="bg-white rounded-xl shadow-xl p-8 border border-gray-200">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600">Total Products</p>
                      <p className="text-2xl font-bold text-gray-900">1,234</p>
                    </div>
                    <CubeIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600">Active Jobs</p>
                      <p className="text-2xl font-bold text-gray-900">45</p>
                    </div>
                    <CogIcon className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600">Inventory Value</p>
                      <p className="text-2xl font-bold text-gray-900">$125K</p>
                    </div>
                    <ChartBarIcon className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join businesses that trust Itory for their inventory and production management
          </p>
          <Link
            to="/login"
            className="inline-flex items-center px-8 py-4 border border-transparent text-base font-semibold rounded-lg text-blue-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Create Your Account
            <ArrowRightIcon className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <img
                  src={LOGO_URL}
                  alt="Itory logo"
                  className="h-8 w-auto object-contain brightness-0 invert"
                />
              </div>
              <p className="text-sm text-gray-400">
                Operational Clarity & Real-Time Control
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Updates</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/privacy.html" className="hover:text-white transition-colors">Privacy</Link></li>
                <li><Link to="/terms.html" className="hover:text-white transition-colors">Terms</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>© {new Date().getFullYear()} Itory. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
