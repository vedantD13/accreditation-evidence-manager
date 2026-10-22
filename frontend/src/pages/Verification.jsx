import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Check, 
  X, 
  Save, 
  FileText, 
  AlertCircle, 
  ShieldCheck, 
  Tag, 
  Calendar, 
  Building, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  Info
} from 'lucide-react';

const MANDATORY_REQUIREMENTS = {
  faculty_publication: ["faculty_name", "journal_name", "DOI", "publication_year"],
  fdp_certificate: ["faculty_name", "organising_institute", "start_date"],
  placement_report: ["package", "academic_year", "company_name", "students_placed"]
};

export default function Verification() {
  const [pendingDocs, setPendingDocs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [currentDocDetails, setCurrentDocDetails] = useState(null);
  
  // Editable states for the current document
  const [editedType, setEditedType] = useState("");
  const [editedFields, setEditedFields] = useState({});
  const [editedMetricId, setEditedMetricId] = useState("");
  const [editedAcademicYear, setEditedAcademicYear] = useState("");
  const [editedDepartment, setEditedDepartment] = useState("");
  
  const [rejectMode, setRejectMode] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPendingDocs();
    fetchCriteria();
  }, []);

  useEffect(() => {
    if (pendingDocs.length > 0 && currentIndex < pendingDocs.length) {
      fetchDocDetails(pendingDocs[currentIndex].id);
    } else {
      setCurrentDocDetails(null);
    }
  }, [currentIndex, pendingDocs]);

  const fetchPendingDocs = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/documents?status=pending_review');
      setPendingDocs(res.data);
      if (res.data.length === 0) setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchCriteria = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/criteria');
      setCriteria(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDocDetails = async (docId) => {
    setLoading(true);
    setRejectMode(false);
    setRemarks("");
    try {
      const res = await axios.get(`http://localhost:8000/api/documents/${docId}`);
      setCurrentDocDetails(res.data);
      
      const doc = res.data.document;
      setEditedType(doc.document_type || "faculty_publication");
      setEditedAcademicYear(doc.academic_year || "2024-25");
      setEditedDepartment(doc.department || "Computer Science & Engineering");
      
      const fieldsObj = {};
      res.data.extracted_fields.forEach(f => {
        fieldsObj[f.field_name] = f.field_value;
      });
      setEditedFields(fieldsObj);
      
      setEditedMetricId(res.data.metric_id || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldName, value) => {
    setEditedFields(prev => ({ ...prev, [fieldName]: value }));
  };

  const submitAction = async (actionStr) => {
    if (actionStr === 'reject' && !remarks.trim()) {
      alert("Remarks are required to reject evidence.");
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        action: actionStr,
        remarks: remarks.trim() || null,
        document_type: editedType,
        extracted_fields: editedFields,
        metric_id: editedMetricId,
        academic_year: editedAcademicYear,
        department: editedDepartment
      };
      
      await axios.post(`http://localhost:8000/api/documents/${currentDocDetails.document.id}/verify`, payload);
      
      // Remove from pending list and advance
      const updatedDocs = [...pendingDocs];
      updatedDocs.splice(currentIndex, 1);
      setPendingDocs(updatedDocs);
      
      if (currentIndex >= updatedDocs.length) {
        setCurrentIndex(Math.max(0, updatedDocs.length - 1));
      }
      
    } catch (err) {
      console.error(err);
      alert("Failed to save verification.");
    } finally {
      setSaving(false);
      setRejectMode(false);
    }
  };

  const handleApprove = () => submitAction('approve');
  const handleCorrect = () => submitAction('correct_and_save');
  const handleReject = () => {
    if (!rejectMode) {
      setRejectMode(true);
    } else {
      submitAction('reject');
    }
  };

  if (loading && !currentDocDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 animate-pulse">
        <ShieldCheck className="h-12 w-12 text-purple-400 mb-3" />
        <h3 className="font-semibold text-lg text-slate-800">Loading Faculty Verification Queue...</h3>
      </div>
    );
  }

  if (pendingDocs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center mt-24 text-slate-500 bg-white rounded-3xl p-12 border border-slate-200/80 shadow-xs max-w-lg mx-auto text-center">
        <div className="h-16 w-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
          <Check className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Queue Caught Up!</h2>
        <p className="text-sm text-slate-500">All uploaded evidence documents have been validated by faculty reviewers.</p>
      </div>
    );
  }

  if (!currentDocDetails) return null;
  const doc = currentDocDetails.document;

  // Check missing mandatory fields
  const expectedFields = MANDATORY_REQUIREMENTS[editedType] || [];
  const missingMandatory = expectedFields.filter(f => !editedFields[f] || !editedFields[f].trim());

  // Check if anything has been modified
  const isEdited = () => {
    if (editedType !== (doc.document_type || "")) return true;
    if (editedMetricId !== (currentDocDetails.metric_id || "")) return true;
    if (editedAcademicYear !== (doc.academic_year || "")) return true;
    if (editedDepartment !== (doc.department || "")) return true;
    
    for (const f of currentDocDetails.extracted_fields) {
      if (editedFields[f.field_name] !== f.field_value) return true;
    }
    return false;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header with Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold mb-2 border border-purple-200/60">
            <ShieldCheck className="h-3.5 w-3.5" />
            Module 7: Human-in-the-Loop Validation
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Faculty Verification Queue</h2>
          <p className="text-slate-500 mt-1">Reviewing document {currentIndex + 1} of {pendingDocs.length} pending verification</p>
        </div>

        {/* Navigation Arrows */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed shadow-xs"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-xs font-bold text-slate-500 px-2">
            {currentIndex + 1} / {pendingDocs.length}
          </span>
          <button
            onClick={() => setCurrentIndex(Math.min(pendingDocs.length - 1, currentIndex + 1))}
            disabled={currentIndex === pendingDocs.length - 1}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed shadow-xs"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Document File & Extracted Text Viewer (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 flex-shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-slate-900 text-sm truncate" title={doc.original_filename}>
                    {doc.original_filename}
                  </h3>
                  <span className="text-xs text-slate-400 uppercase font-semibold">
                    Format: {doc.file_type}
                  </span>
                </div>
              </div>

              {doc.is_duplicate_of && (
                <span className="bg-rose-100 text-rose-800 text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md flex-shrink-0">
                  Duplicate
                </span>
              )}
            </div>

            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Digitized OCR Text Content</span>
              <span>{doc.ocr_text ? `${doc.ocr_text.length} chars` : '0 chars'}</span>
            </div>
            
            <div className="bg-slate-900 text-slate-300 p-4 rounded-2xl text-xs font-mono h-[540px] overflow-y-auto shadow-inner whitespace-pre-wrap leading-relaxed select-text">
              {doc.ocr_text || "No text extracted by OCR engine."}
            </div>
          </div>
        </div>

        {/* Right Column: AI Suggestions & Faculty Validation Form (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-bold text-slate-900">AI Extraction & Classification</h3>
              </div>
              <div className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
                Review Required
              </div>
            </div>

            {/* Missing Mandatory Alert Warning */}
            {missingMandatory.length > 0 && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <strong>Mandatory Fields Incomplete for Accreditation:</strong>
                  <p className="mt-0.5">Please supply: {missingMandatory.map(m => m.replace('_', ' ').toUpperCase()).join(', ')}.</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Document Classification */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Document Classification
                </label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                  value={editedType}
                  onChange={(e) => setEditedType(e.target.value)}
                >
                  <option value="faculty_publication">Faculty Publication / Journal Paper</option>
                  <option value="fdp_certificate">FDP / Training Programme Certificate</option>
                  <option value="placement_report">Student Placement / Salary Report</option>
                  <option value="course_file">Course File / Teaching Record</option>
                  <option value="other">Institutional Evidence (Other)</option>
                </select>
                {doc.classification_confidence && (
                  <p className="text-xs text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> AI Prediction Confidence: {(doc.classification_confidence * 100).toFixed(0)}%
                  </p>
                )}
              </div>

              {/* Department & Academic Year Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={editedAcademicYear}
                    onChange={(e) => setEditedAcademicYear(e.target.value)}
                    placeholder="e.g. 2024-25"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editedDepartment}
                    onChange={(e) => setEditedDepartment(e.target.value)}
                    placeholder="e.g. Computer Science & Engineering"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* Extracted Fields Form */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Extracted Attribute Fields
                </label>
                <div className="space-y-3">
                  {Object.keys(editedFields).map((fieldName, i) => (
                    <div key={i} className="flex flex-col">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 font-bold capitalize">{fieldName.replace('_', ' ')}</span>
                      </div>
                      <input 
                        type="text"
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all font-medium text-slate-800"
                        value={editedFields[fieldName] || ""}
                        onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Accreditation Criterion Mapping */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Accreditation Criterion & Metric Mapping
                </label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                  value={editedMetricId || ""}
                  onChange={(e) => setEditedMetricId(e.target.value)}
                >
                  <option value="">-- Select Target Metric --</option>
                  {criteria.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.criterion_name} ({c.key_indicator})
                    </option>
                  ))}
                </select>
                {currentDocDetails.mapping && (
                  <p className="text-xs text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> AI Mapping Confidence: {(currentDocDetails.mapping.confidence * 100).toFixed(0)}%
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-slate-100 flex flex-col gap-3">
                {rejectMode ? (
                  <div className="bg-rose-50 p-5 rounded-2xl border border-rose-200 mb-2">
                    <label className="block text-xs font-bold text-rose-900 uppercase tracking-wider mb-2">
                      Reason for Rejection (Required)
                    </label>
                    <textarea 
                      className="w-full bg-white border border-rose-200 rounded-xl p-3 text-sm outline-none mb-3 text-slate-800"
                      rows="2"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="e.g. Document image is illegible, missing official seal, or invalid academic year"
                    />
                    <div className="flex gap-3">
                      <button 
                        onClick={handleReject}
                        disabled={saving}
                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-bold text-sm transition-colors flex justify-center items-center gap-2 shadow-xs"
                      >
                        {saving ? "Saving..." : "Confirm Reject"}
                      </button>
                      <button 
                        onClick={() => setRejectMode(false)}
                        className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-3 rounded-xl font-bold text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    {isEdited() ? (
                      <button 
                        onClick={handleCorrect}
                        disabled={saving}
                        className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3.5 px-6 rounded-2xl font-bold text-sm transition-all flex justify-center items-center gap-2 shadow-sm"
                      >
                        <Save className="h-4 w-4" />
                        {saving ? "Saving..." : "Save Corrections & Verify"}
                      </button>
                    ) : (
                      <button 
                        onClick={handleApprove}
                        disabled={saving}
                        className="flex-[2] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 px-6 rounded-2xl font-bold text-sm transition-all flex justify-center items-center gap-2 shadow-sm"
                      >
                        <Check className="h-4 w-4" />
                        {saving ? "Saving..." : "Approve as Correct"}
                      </button>
                    )}
                    
                    <button 
                      onClick={handleReject}
                      disabled={saving}
                      className="flex-1 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-700 border border-slate-200 py-3.5 px-6 rounded-2xl font-bold text-sm transition-colors flex justify-center items-center gap-2 shadow-xs"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
