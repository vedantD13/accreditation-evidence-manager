import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FileText, 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  AlertCircle, 
  Award, 
  Search, 
  FileCheck2, 
  ArrowRight,
  UploadCloud,
  CheckCircle2,
  Building,
  Calendar,
  Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/api/analytics/dashboard');
      setData(response.data);
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const kpis = data?.kpis || {};
  const readiness = data?.readiness || { overall_percentage: 0, projected_grade: "Evaluating...", total_required: 0, total_verified: 0 };
  const criteria = data?.criteria || [];
  const alerts = data?.alerts || [];
  const distributions = data?.distributions || {};

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2 border border-blue-200/60">
            <Award className="h-3.5 w-3.5" />
            Accreditation Framework: NAAC-2024 SSR
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Accreditation Readiness Dashboard</h2>
          <p className="text-slate-500 mt-1">Real-time institutional evidence audit, gap analysis, and AI retrieval</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 font-semibold px-4 py-2.5 rounded-xl text-sm shadow-xs transition-all"
          >
            <Search className="h-4 w-4 text-teal-600" />
            Search Evidence
          </Link>
          <Link
            to="/reports"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm shadow-xs hover:shadow transition-all"
          >
            <FileCheck2 className="h-4 w-4" />
            View SSR Report
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Documents */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs hover:shadow-sm transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Evidence</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">
                {loading ? <span className="animate-pulse bg-slate-200 text-transparent rounded">000</span> : kpis.total_documents || 0}
              </h3>
            </div>
            <div className="h-12 w-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <span>OCR digitized & indexed</span>
          </p>
        </div>

        {/* Verified Documents */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs hover:shadow-sm transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Faculty Verified</p>
              <h3 className="text-3xl font-black text-emerald-600 mt-1">
                {loading ? <span className="animate-pulse bg-slate-200 text-transparent rounded">00</span> : kpis.verified || 0}
              </h3>
            </div>
            <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
          <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Validated for SSR submission
          </p>
        </div>

        {/* Pending Review */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs hover:shadow-sm transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Review</p>
              <h3 className="text-3xl font-black text-amber-500 mt-1">
                {loading ? <span className="animate-pulse bg-slate-200 text-transparent rounded">00</span> : kpis.pending_review || 0}
              </h3>
            </div>
            <div className="h-12 w-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
              <Clock className="h-6 w-6" />
            </div>
          </div>
          <Link to="/verification" className="text-xs text-amber-600 hover:text-amber-700 font-semibold inline-flex items-center gap-1">
            Open review queue <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Duplicates Flagged */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs hover:shadow-sm transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duplicates Flagged</p>
              <h3 className="text-3xl font-black text-rose-500 mt-1">
                {loading ? <span className="animate-pulse bg-slate-200 text-transparent rounded">00</span> : kpis.duplicates_flagged || 0}
              </h3>
            </div>
            <div className="h-12 w-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
          <p className="text-xs text-rose-600 font-medium">Preventing double-counting</p>
        </div>
      </div>

      {/* Main Grid: Institutional Readiness Banner + Audit Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Readiness Gauge & Criteria List (7 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Institutional Readiness Overview Card */}
          <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white rounded-3xl p-7 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                  Institutional Readiness Status
                </span>
                <h3 className="text-2xl font-black text-white mt-1">
                  Overall Preparedness: {readiness.overall_percentage}%
                </h3>
                <p className="text-sm text-slate-300 mt-1 max-w-md">
                  Based on target thresholds across NAAC quality benchmarks.
                </p>

                <div className="mt-4 inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl text-xs font-semibold border border-white/15">
                  <Award className="h-4 w-4 text-amber-400" />
                  <span>Projected Institutional Grade:</span>
                  <strong className="text-emerald-400">{readiness.projected_grade}</strong>
                </div>
              </div>

              {/* Progress Ring / Bar */}
              <div className="flex flex-col items-center justify-center bg-white/5 rounded-2xl p-5 border border-white/10 min-w-[160px]">
                <div className="text-4xl font-extrabold text-white tracking-tight">
                  {readiness.overall_percentage}%
                </div>
                <div className="text-xs text-slate-400 font-medium mt-1">
                  {readiness.total_verified} of {readiness.total_required} Verified
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 mt-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${readiness.overall_percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Criterion-wise Evidence Breakdown (Module 7) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-lg">Criterion-wise Evidence Status</h3>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase">7 NAAC Criteria</span>
            </div>

            <div className="space-y-4">
              {criteria.map((c, i) => {
                const isComplete = c.readiness_percentage >= 90;
                const isPartial = c.readiness_percentage >= 40 && c.readiness_percentage < 90;
                return (
                  <div key={i} className="bg-slate-50/60 rounded-2xl p-4 border border-slate-100 hover:border-slate-200 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase text-slate-400">
                            C{i + 1}
                          </span>
                          <h4 className="font-bold text-slate-800 text-sm truncate">{c.criterion_name}</h4>
                        </div>
                        <p className="text-xs text-slate-500 truncate max-w-lg mt-0.5">{c.metric_name}</p>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                          isComplete ? 'bg-emerald-100 text-emerald-800' : (
                            isPartial ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          )
                        }`}>
                          {c.status}
                        </span>
                        <span className="font-extrabold text-sm text-slate-800 min-w-[45px] text-right">
                          {c.readiness_percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Track */}
                    <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isComplete ? 'bg-emerald-500' : (isPartial ? 'bg-amber-500' : 'bg-rose-500')
                        }`}
                        style={{ width: `${c.readiness_percentage}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mt-2">
                      <span>{c.verified_count} verified of {c.required_count} target</span>
                      {c.missing_count > 0 && (
                        <span className="text-rose-600 font-semibold">{c.missing_count} evidence items required</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Active Audit Alerts & Multi-Agent Telemetry (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Alerts Card (Module 6) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-500" />
                <h3 className="font-bold text-slate-900 text-base">Active Audit Alerts</h3>
              </div>
              <span className="bg-rose-100 text-rose-800 text-xs font-bold px-2 py-0.5 rounded-full">
                {alerts.length}
              </span>
            </div>

            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  No compliance alerts. All evidence thresholds met!
                </div>
              ) : (
                alerts.map((alert) => (
                  <div 
                    key={alert.id}
                    className={`rounded-2xl p-4 border text-xs ${
                      alert.severity === 'critical' ? 'bg-rose-50/60 border-rose-200/70 text-rose-900' : (
                        alert.severity === 'warning' ? 'bg-amber-50/60 border-amber-200/70 text-amber-900' : 'bg-blue-50/60 border-blue-200/70 text-blue-900'
                      )
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="truncate">{alert.title}</span>
                      <span className={`text-[10px] uppercase font-extrabold px-1.5 py-0.2 rounded ${
                        alert.severity === 'critical' ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-800'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed mb-2 font-normal">{alert.message}</p>
                    <div className="pt-2 border-t border-slate-200/40 text-[11px] font-semibold text-slate-700">
                      Action: {alert.action_required}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Upload Callout */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl border border-indigo-100 p-6">
            <h4 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-indigo-600" />
              Upload Supporting Documents
            </h4>
            <p className="text-xs text-slate-600 mb-4">
              AI automatically performs OCR, classifies document type, extracts key metadata, and indexes into ChromaDB.
            </p>
            <Link
              to="/upload"
              className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-xs shadow-xs transition-all"
            >
              Upload Evidence Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
