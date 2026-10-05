import { useState, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, File, CheckCircle, Clock } from 'lucide-react';

export default function Upload() {
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
  };

  const handleFiles = (newFiles) => {
    const fileObjects = newFiles.map(f => ({
      id: null,
      file: f,
      name: f.name,
      status: 'pending',
      progress: 0,
      serverStatus: null
    }));
    setFiles(prev => [...prev, ...fileObjects]);
    fileObjects.forEach(f => uploadFile(f));
  };

  const uploadFile = async (fileObj) => {
    const formData = new FormData();
    formData.append('file', fileObj.file);

    setFiles(prev => prev.map(f => 
      f.name === fileObj.name ? { ...f, status: 'uploading' } : f
    ));

    try {
      const response = await axios.post('http://localhost:8000/api/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setFiles(prev => prev.map(f => 
            f.name === fileObj.name ? { ...f, progress: percentCompleted } : f
          ));
        }
      });

      const docId = response.data.document.id;

      setFiles(prev => prev.map(f => 
        f.name === fileObj.name ? { ...f, status: 'processing', id: docId, progress: 100, serverStatus: 'processing' } : f
      ));
      
      pollStatus(docId, fileObj.name);
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.name === fileObj.name ? { ...f, status: 'error', progress: 0 } : f
      ));
    }
  };

  const pollStatus = (docId, fileName) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`http://localhost:8000/api/documents/${docId}`);
        const serverStatus = response.data.document.status;
        
        setFiles(prev => prev.map(f => 
          f.name === fileName ? { ...f, serverStatus: serverStatus } : f
        ));

        if (serverStatus === 'pending_review' || serverStatus === 'ocr_failed' || serverStatus === 'rejected') {
          clearInterval(interval);
        }
      } catch (err) {
        clearInterval(interval);
      }
    }, 1500);
  };

  const getStatusDisplay = (f) => {
    if (f.status === 'error') return { text: 'Upload Failed', color: 'bg-red-500' };
    if (f.status === 'uploading') return { text: 'Uploading', color: 'bg-blue-500' };
    
    switch(f.serverStatus) {
      case 'processing': return { text: 'OCR in Progress...', color: 'bg-yellow-400' };
      case 'ocr_complete': return { text: 'Classifying...', color: 'bg-purple-500' };
      case 'ocr_failed': return { text: 'OCR Failed', color: 'bg-red-500' };
      case 'pending_review': return { text: 'Pending Review', color: 'bg-green-500' };
      default: return { text: 'Processing', color: 'bg-blue-500' };
    }
  };

  const isComplete = (f) => f.serverStatus === 'pending_review' || f.serverStatus === 'ocr_failed';

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Upload Evidence</h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8">
        <div 
          className="border-2 border-dashed border-blue-300 rounded-xl bg-blue-50/50 p-12 text-center hover:bg-blue-50 transition-colors cursor-pointer"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current.click()}
        >
          <UploadCloud className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-800 mb-1">Drag files or click to browse</h3>
          <p className="text-slate-500 text-sm">Supported formats: PDF, DOCX, XLSX, JPG, PNG</p>
          <input 
            type="file" 
            className="hidden" 
            multiple 
            ref={fileInputRef}
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {files.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
            <h3 className="font-semibold text-slate-800">Processing Queue</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {files.map((f, idx) => {
              const display = getStatusDisplay(f);
              const completed = isComplete(f);
              return (
                <div key={idx} className="p-4 px-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <File className="h-5 w-5 text-slate-400" />
                    <span className="font-medium text-slate-700">{f.name}</span>
                  </div>
                  
                  <div className="flex items-center space-x-6 w-1/2">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500 font-medium">{display.text}</span>
                        {f.status === 'uploading' && <span className="text-blue-600 font-medium">{f.progress}%</span>}
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden relative">
                         <div 
                          className={`h-1.5 rounded-full ${display.color} ${!completed && f.status !== 'uploading' ? 'animate-pulse' : ''}`} 
                          style={{ width: `${f.status === 'uploading' ? f.progress : 100}%` }}
                        ></div>
                      </div>
                    </div>
                    {completed && f.serverStatus !== 'ocr_failed' ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                       f.status !== 'error' && f.serverStatus !== 'ocr_failed' && <Clock className="h-5 w-5 text-slate-400 flex-shrink-0 animate-spin" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
