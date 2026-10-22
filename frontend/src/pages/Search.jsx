import { useState } from 'react';
import axios from 'axios';
import { 
  Search as SearchIcon, 
  Sparkles, 
  FileText, 
  ShieldCheck, 
  FolderOpen, 
  Tag, 
  Calendar, 
  Building, 
  ExternalLink,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

const SUGGESTED_QUERIES = [
  "Show documents supporting research activities and publications",
  "Find evidence related to faculty development programmes (FDP)",
  "Retrieve all documents related to student placements and packages",
  "Show documents from the Computer Science department",
  "Find evidence for student progression and higher education"
];

export default function Search() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [ragResult, setRagResult] = useState(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  const [searched, setSearched] = useState(false);

  const handleSearch = async (searchQuery) => {
    const q = searchQuery !== undefined ? searchQuery : query;
    if (!q || !q.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const response = await axios.post('http://localhost:8000/api/search/rag', {
        query: q.trim(),
        top_k: 6,
        document_type: selectedTypeFilter !== 'all' ? selectedTypeFilter : null
      });
      setRagResult(response.data);
    } catch (error) {
      console.error("RAG search failed", error);
      setRagResult({
        query: q,
        answer: "Unable to retrieve evidence at this moment. Please ensure the backend service and vector database are active.",
        sources: [],
        total_found: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChipClick = (suggestion) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  const filteredSources = ragResult?.sources ? ragResult.sources.filter(s => {
    if (selectedTypeFilter === 'all') return true;
    return s.document_type === selectedTypeFilter;
  }) : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-2 border border-teal-200/60">
            <Sparkles className="h-3.5 w-3.5" />
            Module 5: RAG & Semantic Retrieval
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Intelligent Evidence Retrieval</h2>
          <p className="text-slate-500 mt-1">Ask natural-language questions to discover evidence, extract facts, and verify criteria alignment</p>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-4 transition-all focus-within:ring-4 focus-within:ring-teal-500/10 focus-within:border-teal-500">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
          className="flex items-center gap-3"
        >
          <div className="relative flex-1">
            <SearchIcon className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-teal-600" />
            <input 
              id="rag-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Show documents supporting research activities with journal DOIs..."
              className="w-full bg-slate-50/70 border-0 rounded-2xl pl-12 pr-4 py-3.5 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white transition-all"
            />
          </div>
          <button 
            id="rag-search-btn"
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold px-7 py-3.5 rounded-2xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Ask AI</span>
              </>
            )}
          </button>
        </form>

        {/* Suggestion Chips */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <HelpCircle className="h-3 w-3" /> Prompts:
          </span>
          {SUGGESTED_QUERIES.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(sq)}
              className="text-xs bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 font-medium px-3 py-1.5 rounded-lg border border-slate-200/60 transition-colors text-left"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* AI Synthesized Answer Card */}
      {ragResult && (
        <div className="bg-gradient-to-br from-white via-slate-50/50 to-teal-50/30 rounded-3xl border border-teal-200/80 shadow-sm p-7 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-teal-100/80">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">AI Evidence Synthesis</h3>
                <p className="text-xs text-slate-500">Retrieval-Augmented Generation across indexed ChromaDB evidence</p>
              </div>
            </div>
            {ragResult.confidence_level && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                ragResult.confidence_level === 'High' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {ragResult.confidence_level} Confidence
              </span>
            )}
          </div>

          <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-sans">
            {ragResult.answer}
          </div>

          {ragResult.criteria_supported && ragResult.criteria_supported.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-200/60 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500">Accreditation Alignment:</span>
              {ragResult.criteria_supported.map((crit, idx) => (
                <span key={idx} className="bg-blue-50 text-blue-700 border border-blue-200/60 px-2.5 py-0.5 rounded-md text-xs font-medium">
                  {crit}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Evidence Source Results */}
      {searched && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-slate-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Matched Evidence Documents ({filteredSources.length})
              </h3>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
              <Filter className="h-3.5 w-3.5 text-slate-400 ml-2" />
              {['all', 'faculty_publication', 'fdp_certificate', 'placement_report'].map((ft) => (
                <button
                  key={ft}
                  onClick={() => setSelectedTypeFilter(ft)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                    selectedTypeFilter === ft ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  {ft === 'all' ? 'All Types' : ft.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {filteredSources.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-700">No matching evidence found for this filter.</p>
              <p className="text-xs text-slate-400 mt-1">Try broadening your search query or uploading additional documents.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredSources.map((source, idx) => (
                <div 
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Title and Similarity Score */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="font-bold text-slate-900 text-sm truncate" title={source.filename}>
                            {source.filename}
                          </h4>
                          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                            {source.document_type.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-xs px-2.5 py-0.5 rounded-full">
                          {(source.highest_similarity * 100).toFixed(0)}% Match
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Semantic score</span>
                      </div>
                    </div>

                    {/* Mapping Indicator */}
                    {source.mapping && (
                      <div className="bg-slate-50 rounded-xl p-2.5 mb-3 border border-slate-100 text-xs">
                        <div className="font-semibold text-slate-800">{source.mapping.criterion_name}</div>
                        <div className="text-slate-500 text-[11px] truncate">{source.mapping.key_indicator} • {source.mapping.metric_name}</div>
                      </div>
                    )}

                    {/* Extracted Fields Badges */}
                    {source.extracted_fields && Object.keys(source.extracted_fields).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {Object.entries(source.extracted_fields).slice(0, 4).map(([k, v], i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded-md">
                            <Tag className="h-2.5 w-2.5 text-slate-400" />
                            <strong className="capitalize">{k.replace('_', ' ')}:</strong> {String(v).slice(0, 25)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Matched Snippet */}
                    {source.snippets && source.snippets[0] && (
                      <div className="bg-slate-900 text-slate-300 rounded-xl p-3 text-xs font-mono line-clamp-3 mb-4">
                        "{source.snippets[0]}"
                      </div>
                    )}
                  </div>

                  {/* Footer Info */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-3">
                      {source.academic_year && source.academic_year !== 'N/A' && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {source.academic_year}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        source.status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {source.status}
                      </span>
                    </div>

                    <Link
                      to="/verification"
                      className="text-teal-600 hover:text-teal-700 font-semibold inline-flex items-center gap-1"
                    >
                      Inspect <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
