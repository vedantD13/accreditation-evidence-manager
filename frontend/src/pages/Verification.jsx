import { useState, useEffect } from 'react';
import axios from 'axios';
import { Check, X, Save, FileText, AlertCircle } from 'lucide-react';

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
      
      // Initialize edit states
      setEditedType(res.data.document.document_type || "");
      
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
      alert("Remarks are required to reject.");
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        action: actionStr,
        remarks: remarks.trim() || null,
        document_type: editedType,
        extracted_fields: editedFields,
        metric_id: editedMetricId
      };
      
      await axios.post(`http://localhost:8000/api/documents/${currentDocDetails.document.id}/verify`, payload);
      
      // Remove from list and advance
      const updatedDocs = [...pendingDocs];
      updatedDocs.splice(currentIndex, 1);
      setPendingDocs(updatedDocs);
      
      // Index stays the same unless we were at the end
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
    return <div className="text-center text-slate-500 mt-20 animate-pulse">Loading queue...</div>;
  }

  if (pendingDocs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center mt-32 text-slate-500">
        <Check className="h-16 w-16 text-green-400 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">You're all caught up!</h2>
        <p>No documents pending review.</p>
      </div>
    );
  }

  if (!currentDocDetails) return null;
  const doc = currentDocDetails.document;

  // Has anything been edited?
  const isEdited = () => {
    if (editedType !== (doc.document_type || "")) return true;
    if (editedMetricId !== (currentDocDetails.metric_id || "")) return true;
    
    for (const f of currentDocDetails.extracted_fields) {
      if (editedFields[f.field_name] !== f.field_value) return true;
    }
    return false;
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Verification Queue</h2>
          <p className="text-slate-500 mt-1">Reviewing {currentIndex + 1} of {pendingDocs.length} pending documents</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Document Info Column */}
        <div className="col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center space-x-3 mb-6 flex-wrap gap-y-2">
              <FileText className="h-6 w-6 text-purple-500" />
              <h3 className="font-semibold text-slate-800 truncate max-w-full">{doc.original_filename}</h3>
              {doc.is_duplicate_of && (
                <span className="bg-red-100 text-red-700 text-[10px] uppercase font-bold px-2 py-1 rounded">Duplicate Flagged</span>
              )}
            </div>
            
            <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono h-[500px] overflow-y-auto shadow-sm whitespace-pre-wrap">
              {doc.ocr_text || "No text extracted."}
            </div>
          </div>
        </div>

        {/* Verification Form Column */}
        <div className="col-span-7 flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800">AI Extractions</h3>
              <div className="text-xs font-medium px-2 py-1 bg-amber-100 text-amber-800 rounded">Pending Review</div>
            </div>

            <div className="space-y-6">
              {/* Document Type */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Document Type</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  value={editedType}
                  onChange={(e) => setEditedType(e.target.value)}
                >
                  <option value="faculty_publication">Faculty Publication</option>
                  <option value="fdp_certificate">FDP Certificate</option>
                  <option value="placement_report">Placement Report</option>
                  <option value="other">Other</option>
                </select>
                {doc.classification_confidence && (
                  <p className="text-xs text-green-600 mt-1">AI Confidence: {(doc.classification_confidence * 100).toFixed(0)}%</p>
                )}
              </div>

              {/* Extracted Fields */}
              {currentDocDetails.extracted_fields.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Extracted Fields</label>
                  <div className="space-y-3">
                    {currentDocDetails.extracted_fields.map((f, i) => (
                      <div key={i} className="flex flex-col">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500 font-medium capitalize">{f.field_name.replace('_', ' ')}</span>
                          <span className="text-green-600">{(f.confidence * 100).toFixed(0)}% conf</span>
                        </div>
                        <input 
                          type="text"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                          value={editedFields[f.field_name] || ""}
                          onChange={(e) => handleFieldChange(f.field_name, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mapping */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-semibold text-slate-700 mb-3">Accreditation Mapping</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  value={editedMetricId || ""}
                  onChange={(e) => setEditedMetricId(e.target.value)}
                >
                  <option value="">-- No Mapping --</option>
                  {criteria.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.key_indicator}: {c.metric_name}
                    </option>
                  ))}
                </select>
                {currentDocDetails.mapping && (
                  <p className="text-xs text-green-600 mt-1">AI Confidence: {(currentDocDetails.mapping.confidence * 100).toFixed(0)}%</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-8 flex flex-col gap-3">
                {rejectMode ? (
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-2">
                    <label className="block text-sm font-medium text-red-800 mb-2">Reason for Rejection (Required)</label>
                    <textarea 
                      className="w-full bg-white border border-red-200 rounded-lg p-3 text-sm outline-none mb-3"
                      rows="2"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="e.g. Document is blurry, missing pages, etc."
                    ></textarea>
                    <div className="flex gap-3">
                      <button 
                        onClick={handleReject}
                        disabled={saving}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium text-sm transition-colors flex justify-center items-center gap-2"
                      >
                        {saving ? "Saving..." : "Confirm Reject"}
                      </button>
                      <button 
                        onClick={() => setRejectMode(false)}
                        className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-2.5 rounded-lg font-medium text-sm transition-colors"
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
                        className="flex-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium text-sm transition-colors flex justify-center items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {saving ? "Saving..." : "Save Corrections & Verify"}
                      </button>
                    ) : (
                      <button 
                        onClick={handleApprove}
                        disabled={saving}
                        className="flex-2 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-medium text-sm transition-colors flex justify-center items-center gap-2"
                      >
                        <Check className="h-4 w-4" />
                        {saving ? "Saving..." : "Approve as Correct"}
                      </button>
                    )}
                    
                    <button 
                      onClick={handleReject}
                      disabled={saving}
                      className="flex-1 bg-white hover:bg-red-50 hover:text-red-600 text-slate-700 border border-slate-200 py-3 px-6 rounded-lg font-medium text-sm transition-colors flex justify-center items-center gap-2"
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
    </>
  );
}
