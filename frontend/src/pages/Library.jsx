import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Search } from 'lucide-react';

export default function Library() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [docDetails, setDocDetails] = useState({});

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/documents');
      setDocuments(response.data);
    } catch (error) {
      console.error("Failed to fetch documents", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = async (docId) => {
    if (expandedDocId === docId) {
      setExpandedDocId(null);
      return;
    }
    setExpandedDocId(docId);
    if (!docDetails[docId]) {
      try {
        const response = await axios.get(`http://localhost:8000/api/documents/${docId}`);
        setDocDetails(prev => ({ ...prev, [docId]: response.data }));
      } catch (err) {
        console.error("Failed to fetch details", err);
      }
    }
  };

  const getStatusChip = (status) => {
    switch(status) {
      case 'processing': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">OCR Processing</span>;
      case 'ocr_complete': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Classifying</span>;
      case 'ocr_failed': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">OCR Failed</span>;
      case 'pending_review': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Pending Review</span>;
      case 'verified': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Verified</span>;
      case 'rejected': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Rejected</span>;
      default: return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Document Library</h2>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Filter documents..." 
            className="bg-white border border-slate-200 rounded-full pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <th className="px-6 py-4 font-medium">Filename</th>
              <th className="px-6 py-4 font-medium">Classification</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Upload Date</th>
              <th className="px-6 py-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                  <div className="h-8 w-8 text-slate-200 mx-auto mb-2 rounded-full bg-slate-100 animate-pulse" />
                  Loading documents...
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                  No documents found. Upload some evidence to get started.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <React.Fragment key={doc.id}>
                  <tr 
                    className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${expandedDocId === doc.id ? 'bg-blue-50/30' : ''}`}
                    onClick={() => toggleRow(doc.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-slate-400 flex-shrink-0" />
                          <span className="font-medium text-slate-700 break-all">{doc.original_filename}</span>
                        </div>
                        {doc.is_duplicate_of && (
                          <span className="bg-red-100 text-red-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded w-max mt-1 ml-8">Duplicate Flagged</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {doc.document_type ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-800 capitalize">
                            {doc.document_type.replace('_', ' ')}
                          </span>
                          {doc.classification_confidence && (
                            <span className="text-xs text-slate-500">
                              {(doc.classification_confidence * 100).toFixed(0)}% Match
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">Pending Classification</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="uppercase text-xs font-semibold bg-slate-100 px-2 py-1 rounded text-slate-600">
                        {doc.file_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                      {new Date(doc.upload_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusChip(doc.status)}
                    </td>
                  </tr>
                  
                  {expandedDocId === doc.id && (
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <td colSpan="5" className="px-8 py-6">
                        {!docDetails[doc.id] ? (
                          <div className="text-sm text-slate-500 animate-pulse">Loading details...</div>
                        ) : (
                          <div className="grid grid-cols-2 gap-8">
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Accreditation Mapping</h4>
                              {docDetails[doc.id].mapping ? (
                                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
                                  <div className="flex justify-between items-start pb-2 border-b border-slate-50">
                                    <span className="text-sm text-slate-500 font-medium">Criterion</span>
                                    <span className="text-sm text-slate-900 font-medium text-right ml-4">{docDetails[doc.id].mapping.criterion_name}</span>
                                  </div>
                                  <div className="flex justify-between items-start pb-2 border-b border-slate-50">
                                    <span className="text-sm text-slate-500 font-medium">Indicator</span>
                                    <span className="text-sm text-slate-900 font-medium text-right ml-4">{docDetails[doc.id].mapping.key_indicator}</span>
                                  </div>
                                  <div className="flex justify-between items-start pb-2 border-b border-slate-50">
                                    <span className="text-sm text-slate-500 font-medium">Metric</span>
                                    <span className="text-sm text-slate-900 font-medium text-right ml-4">{docDetails[doc.id].mapping.metric_name}</span>
                                  </div>
                                  <div className="flex justify-between items-start">
                                    <span className="text-sm text-slate-500 font-medium">AI Confidence</span>
                                    <span className="text-sm text-green-600 font-medium text-right ml-4">
                                      {(docDetails[doc.id].mapping.confidence * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-slate-500 italic bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">No mapping determined yet.</div>
                              )}

                              <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Extracted Fields</h4>
                              {docDetails[doc.id].extracted_fields?.length > 0 ? (
                                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                  {docDetails[doc.id].extracted_fields.map((f, i) => (
                                    <div key={i} className="flex justify-between items-center pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                                      <span className="text-sm text-slate-500 font-medium capitalize">{f.field_name.replace('_', ' ')}</span>
                                      <div className="text-right">
                                        <div className="text-sm text-slate-900 font-medium">{f.field_value}</div>
                                        <div className="text-[10px] text-green-600">{(f.confidence * 100).toFixed(0)}% conf</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-slate-500 italic bg-white p-4 rounded-xl border border-slate-200 shadow-sm">No fields extracted yet.</div>
                              )}
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">OCR Text Snippet</h4>
                              <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono h-48 overflow-y-auto shadow-sm">
                                {docDetails[doc.id].document.ocr_text || "No text extracted."}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
