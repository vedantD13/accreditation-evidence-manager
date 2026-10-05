import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import {
  UploadCloud,
  FolderOpen,
  ShieldCheck,
  Search,
  BarChart2,
  Settings,
  GraduationCap
} from 'lucide-react'

// Placeholder Page Components
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Library from './pages/Library'
import Verification from './pages/Verification'

function PagePlaceholder({ title }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <div className="h-16 w-16 text-slate-200 mx-auto mb-4 rounded-xl bg-slate-100 animate-pulse" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">{title} coming soon</h3>
        <p className="text-slate-500">This module is currently being built.</p>
      </div>
    </div>
  );
}

const navItems = [
  { name: 'Upload Evidence', path: '/upload', icon: UploadCloud, color: 'text-blue-600', activeBg: 'bg-blue-50' },
  { name: 'Document Library', path: '/library', icon: FolderOpen, color: 'text-orange-500', activeBg: 'bg-orange-50' },
  { name: 'Verification Queue', path: '/verification', icon: ShieldCheck, color: 'text-purple-600', activeBg: 'bg-purple-50' },
  { name: 'Search & Ask', path: '/search', icon: Search, color: 'text-teal-600', activeBg: 'bg-teal-50' },
  { name: 'Dashboard', path: '/', icon: BarChart2, color: 'text-green-600', activeBg: 'bg-green-50' },
  { name: 'Admin Settings', path: '/admin', icon: Settings, color: 'text-slate-600', activeBg: 'bg-slate-50' },
]

function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md z-10">
        <div className="flex items-center h-16 px-6">
          <GraduationCap className="h-8 w-8 mr-3" />
          <h1 className="text-xl font-semibold tracking-wide">Accreditation Evidence Manager</h1>
          
          <div className="ml-auto flex items-center space-x-4">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-200" />
              <input 
                type="text" 
                placeholder="Search modules..." 
                className="bg-blue-800/50 text-white placeholder-blue-200 rounded-full pl-10 pr-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/50 border border-blue-500/30 text-sm w-64"
              />
            </div>
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center font-semibold text-sm border border-white/30 cursor-pointer">
              DS
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 shadow-sm overflow-y-auto">
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (location.pathname === '/' && item.path === '/');
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive
                      ? `${item.activeBg} text-slate-900 border border-slate-200/50 shadow-sm`
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <item.icon className={`h-5 w-5 mr-3 ${isActive ? item.color : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/library" element={<Library />} />
          <Route path="/verification" element={<Verification />} />
          <Route path="/search" element={<PagePlaceholder title="Search & Ask" />} />
          <Route path="/admin" element={<PagePlaceholder title="Admin Settings" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
