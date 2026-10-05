import { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get('http://localhost:8000/api/stats');
        setStats(response.data);
      } catch (error) {
        console.error("Failed to fetch stats", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Readiness Dashboard</h2>
          <p className="text-slate-500 mt-1">Real-time overview of accreditation evidence processing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Documents */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Total Evidence</p>
              <h3 className="text-3xl font-bold text-slate-800">
                {loading ? <span className="animate-pulse bg-slate-200 text-transparent rounded">000</span> : stats?.total_documents || 0}
              </h3>
            </div>
            <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
            <FileText className="h-24 w-24" />
          </div>
        </div>

        {/* Verified */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Verified</p>
              <h3 className="text-3xl font-bold text-green-600">
                {loading ? <span className="animate-pulse bg-slate-200 text-transparent rounded">00</span> : stats?.verified || 0}
              </h3>
            </div>
            <div className="h-10 w-10 bg-green-50 rounded-xl flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
            <ShieldCheck className="h-24 w-24" />
          </div>
        </div>

        {/* Pending Review */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Pending Review</p>
              <h3 className="text-3xl font-bold text-amber-500">
                {loading ? <span className="animate-pulse bg-slate-200 text-transparent rounded">00</span> : stats?.pending_review || 0}
              </h3>
            </div>
            <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
            <Clock className="h-24 w-24" />
          </div>
        </div>

        {/* Duplicates Flagged */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Duplicates Flagged</p>
              <h3 className="text-3xl font-bold text-red-500">
                {loading ? <span className="animate-pulse bg-slate-200 text-transparent rounded">00</span> : stats?.duplicates_flagged || 0}
              </h3>
            </div>
            <div className="h-10 w-10 bg-red-50 rounded-xl flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
            <AlertTriangle className="h-24 w-24" />
          </div>
        </div>
      </div>
    </>
  );
}
