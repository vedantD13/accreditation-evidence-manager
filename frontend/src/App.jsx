import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import {
  UploadCloud,
  FolderOpen,
  ShieldCheck,
  Search as SearchIcon,
  BarChart2,
  Settings,
  GraduationCap,
  FileCheck2
} from 'lucide-react'

// Page Components
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Library from './pages/Library'
import Verification from './pages/Verification'
import Search from './pages/Search'
import Reports from './pages/Reports'

function PagePlaceholder({ title }) {
  return (
    <div className="bg-white rounded-3xl shadow-xs border border-slate-200 p-12 min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <div className="h-16 w-16 text-slate-200 mx-auto mb-4 rounded-2xl bg-slate-100 animate-pulse" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title} Configuration</h3>
        <p className="text-slate-500 text-sm">System administration and institutional profile configuration.</p>
      </div>
    </div>
  );
}

const navItems = [
  { name: 'Dashboard', path: '/', icon: BarChart2, color: 'text-blue-600', activeBg: 'bg-blue-50' },
  { name: 'Upload Evidence', path: '/upload', icon: UploadCloud, color: 'text-indigo-600', activeBg: 'bg-indigo-50' },
  { name: 'Document Library', path: '/library', icon: FolderOpen, color: 'text-amber-500', activeBg: 'bg-amber-50' },
  { name: 'Verification Queue', path: '/verification', icon: ShieldCheck, color: 'text-purple-600', activeBg: 'bg-purple-50' },
  { name: 'Intelligent Search (RAG)', path: '/search', icon: SearchIcon, color: 'text-teal-600', activeBg: 'bg-teal-50' },
  { name: 'Accreditation Reports', path: '/reports', icon: FileCheck2, color: 'text-emerald-600', activeBg: 'bg-emerald-50' },
  { name: 'Admin Settings', path: '/admin', icon: Settings, color: 'text-slate-600', activeBg: 'bg-slate-50' },
]

function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shadow-sm z-10">
        <div className="flex items-center h-16 px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-9 w-9 bg-white/15 rounded-xl flex items-center justify-center border border-white/20">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide">Accreditation Evidence Manager</h1>
              <p className="text-[10px] text-blue-200 font-medium">AI-Driven Institutional Compliance Framework</p>
            </div>
          </Link>
          
          <div className="ml-auto flex items-center space-x-4">
            <Link 
              to="/search" 
              className="bg-blue-800/60 hover:bg-blue-800 text-blue-100 hover:text-white px-3.5 py-1.5 rounded-full text-xs font-medium border border-blue-500/40 flex items-center gap-2 transition-colors"
            >
              <SearchIcon className="h-3.5 w-3.5 text-blue-300" />
              <span>Semantic Search...</span>
            </Link>
            <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs border border-white/30 cursor-pointer text-white">
              VD
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200/90 shadow-xs overflow-y-auto">
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider px-3 mb-2">Navigation</p>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`w-full flex items-center px-3.5 py-2.5 text-xs font-semibold rounded-2xl transition-all duration-200 ${
                      isActive
                        ? `${item.activeBg} text-slate-900 border border-slate-200/60 shadow-xs`
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <item.icon className={`h-4 w-4 mr-3 ${isActive ? item.color : 'text-slate-400'}`} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
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
          <Route path="/search" element={<Search />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/admin" element={<PagePlaceholder title="Admin Settings" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
