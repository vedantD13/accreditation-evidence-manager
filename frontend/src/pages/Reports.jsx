import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FileCheck2, 
  Download, 
  Printer, 
  Layers, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  ExternalLink,
  ChevronDown,
  Building2,
  Calendar
} from 'lucide-react';

export default function Reports() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCriterionId, setSelectedCriterionId] = useState('all');
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'inventory'

  useEffect(() => {
    fetchSSRReport();
  }, []);

  const fetchSSRReport = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/api/reports/ssr');
      setReportData(response.data);
    } catch (err) {
      console.error("Failed to load SSR report", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadMarkdown = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/reports/ssr/markdown');
      const blob = new Blob([response.data], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Institutional_Accreditation_SSR_Report_${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download report.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 animate-pulse">
        <FileCheck2 className="h-12 w-12 text-blue-400 mb-3" />
        <h3 className="font-semibold text-lg text-slate-800">Generating SSR Accreditation Evidence Dossier...</h3>
        <p className="text-sm text-slate-400">Compiling criterion metrics, evidence inventories, and gap analytics</p>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
        Failed to load report. Please ensure the backend is running.
      </div>
    );
  }

  const sectionsToDisplay = selectedCriterionId === 'all' 
    ? reportData.criteria_sections 
    : reportData.criteria_sections.filter(s => s.criterion.id === selectedCriterionId);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header with Export Options */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-2 border border-indigo-200/60">
            <FileCheck2 className="h-3.5 w-3.5" />
            Module 8: Formal Evidence Reporting
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Accreditation Evidence Dossier</h2>
          <p className="text-slate-500 mt-1">Criterion-wise evidence audit reports aligned with {reportData.framework}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 font-semibold px-4 py-2.5 rounded-xl text-sm shadow-xs transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            Export Markdown
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm shadow-xs transition-all"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Executive Summary Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-7 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2 border-b md:border-b-0 md:border-r border-white/10 pb-4 md:pb-0 md:pr-6">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Self-Study Report Summary</span>
            <h3 className="text-2xl font-bold mt-1">{reportData.institution_name}</h3>
            <p className="text-sm text-slate-300 mt-2">
              Generated: {reportData.generated_at} • Aligned with NAAC Quality Indicators
            </p>
            <div className="mt-4 inline-flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-white/15">
              <span>Projected Assessment:</span>
              <strong className="text-emerald-400">{reportData.projected_grade}</strong>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Overall Readiness</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-extrabold text-white">{reportData.overall_readiness_percentage}%</span>
              <span className="text-xs text-emerald-400 font-semibold">Quality Index</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-400 to-emerald-400 h-2 rounded-full" 
                style={{ width: `${reportData.overall_readiness_percentage}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Evidence Status</span>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Required:</span>
                <span className="font-bold text-white">{reportData.summary.total_required}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Verified:</span>
                <span className="font-bold text-emerald-400">{reportData.summary.total_verified}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Available:</span>
                <span className="font-bold text-indigo-300">{reportData.summary.total_available}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter by Criterion */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-indigo-600" />
          <span className="font-bold text-sm text-slate-800">Filter Criterion:</span>
          <select
            value={selectedCriterionId}
            onChange={(e) => setSelectedCriterionId(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All 7 Criteria (Complete Dossier)</option>
            {reportData.criteria_sections.map(sec => (
              <option key={sec.criterion.id} value={sec.criterion.id}>
                {sec.criterion.criterion_name} ({sec.criterion.key_indicator})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'summary' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Metric Summary
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'inventory' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Evidence Inventory Table
          </button>
        </div>
      </div>

      {/* Criterion Dossiers */}
      <div className="space-y-6">
        {sectionsToDisplay.map((sec, idx) => {
          const crit = sec.criterion;
          const isComplete = crit.readiness_percentage >= 90;
          return (
            <div 
              key={crit.id} 
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Criterion Card Header */}
              <div className="p-6 bg-slate-50/60 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                      Criterion {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Indicator: {crit.key_indicator}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-900">{crit.criterion_name}</h4>
                  <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                    <strong>Metric:</strong> {crit.metric_name}
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-slate-900">{crit.readiness_percentage}%</div>
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      isComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {crit.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress and Key Statistics */}
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-white border-b border-slate-100 text-center">
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-xs text-slate-500 font-medium">Required Evidence</span>
                  <div className="text-xl font-bold text-slate-800 mt-0.5">{crit.required_count}</div>
                </div>
                <div className="p-3 bg-emerald-50/60 rounded-2xl">
                  <span className="text-xs text-emerald-700 font-medium">Verified Evidence</span>
                  <div className="text-xl font-bold text-emerald-700 mt-0.5">{crit.verified_count}</div>
                </div>
                <div className="p-3 bg-indigo-50/60 rounded-2xl">
                  <span className="text-xs text-indigo-700 font-medium">Total Available</span>
                  <div className="text-xl font-bold text-indigo-700 mt-0.5">{crit.available_count}</div>
                </div>
                <div className="p-3 bg-rose-50/60 rounded-2xl">
                  <span className="text-xs text-rose-700 font-medium">Deficit / Missing</span>
                  <div className="text-xl font-bold text-rose-700 mt-0.5">{crit.gap}</div>
                </div>
              </div>

              {/* Evidence Inventory Table */}
              <div className="p-6">
                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Mapped Supporting Evidence Documents ({sec.evidence_inventory.length})
                </h5>

                {sec.evidence_inventory.length === 0 ? (
                  <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-6 text-center text-amber-800 text-sm">
                    <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                    <strong>No supporting documents currently mapped to this criterion.</strong>
                    <p className="text-xs text-amber-700 mt-1">Upload relevant certificates or documents and assign them in the Verification Queue.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="px-4 py-3">Document Filename</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Academic Year</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3">Extracted Fields Highlights</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sec.evidence_inventory.map((item, docIdx) => (
                          <tr key={docIdx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800 max-w-xs truncate">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                <span title={item.filename}>{item.filename}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 capitalize">
                              {item.document_type}
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-mono">
                              {item.academic_year}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {item.department}
                            </td>
                            <td className="px-4 py-3 text-slate-700 max-w-sm">
                              {Object.keys(item.extracted_fields).length > 0 ? (
                                <div className="space-y-0.5">
                                  {Object.entries(item.extracted_fields).slice(0, 2).map(([k, v], fi) => (
                                    <div key={fi} className="truncate">
                                      <span className="font-semibold capitalize text-slate-500">{k.replace('_', ' ')}:</span> {v}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">No extractions</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                item.status === 'verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
