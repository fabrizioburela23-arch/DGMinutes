import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Upload, LogOut, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

export default function InterpreterDashboard() {
  const { user, logout, token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    interpreterId: user?.interpreterId || '',
    dateRange: '',
    totalMinutes: '',
    totalCalls: '',
    recordType: 'daily'
  });
  const [records, setRecords] = useState<any[]>([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/records', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setMessage({ type: '', text: '' });
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          
          const prompt = `
            Analyze this screenshot of an interpreter's daily dashboard.
            Extract the following information:
            - interpreterId: The ID of the interpreter.
            - dateRange: The date range of the report (e.g. "2023-10-01 to 2023-10-01").
            - totalMinutes: The total number of minutes logged.
            - totalCalls: The total number of calls taken.
          `;

          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
              parts: [
                { text: prompt },
                { inlineData: { data: base64Data, mimeType: file.type } }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  interpreterId: { type: Type.STRING },
                  dateRange: { type: Type.STRING },
                  totalMinutes: { type: Type.NUMBER },
                  totalCalls: { type: Type.NUMBER }
                }
              }
            }
          });

          const text = response.text || "{}";
          const extractedData = JSON.parse(text);
          
          setFormData(prev => ({
            ...prev,
            interpreterId: extractedData.interpreterId || user?.interpreterId || '',
            dateRange: extractedData.dateRange || '',
            totalMinutes: extractedData.totalMinutes?.toString() || '',
            totalCalls: extractedData.totalCalls?.toString() || ''
          }));
          setMessage({ type: 'success', text: 'Image analyzed successfully. Please verify the extracted data.' });
        } catch (err: any) {
          setMessage({ type: 'error', text: err.message || 'Failed to analyze image.' });
        } finally {
          setAnalyzing(false);
        }
      };
      reader.onerror = () => {
        setMessage({ type: 'error', text: 'Failed to read file.' });
        setAnalyzing(false);
      };
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred during analysis setup.' });
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          interpreterId: formData.interpreterId,
          dateRange: formData.dateRange,
          totalMinutes: parseInt(formData.totalMinutes, 10),
          totalCalls: parseInt(formData.totalCalls, 10),
          recordType: formData.recordType
        })
      });
      
      if (res.ok) {
        setMessage({ type: 'success', text: 'Record submitted successfully!' });
        setFormData({ interpreterId: user?.interpreterId || '', dateRange: '', totalMinutes: '', totalCalls: '', recordType: 'daily' });
        setFile(null);
        fetchRecords();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to submit record.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred during submission.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="font-black text-3xl text-gradient-dgm tracking-tighter mr-3">DGM</span>
              <span className="font-medium text-lg text-gradient-dgm border-l-2 border-gray-200 pl-3">Interpreter Portal</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.fullName}</span>
              <button onClick={logout} className="text-gray-500 hover:text-gray-700 flex items-center">
                <LogOut className="h-5 w-5 mr-1" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Upload & Form Section */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gradient-dgm mb-4">Upload Screenshot</h3>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-dgm-red transition-colors">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-dgm-navy hover:text-dgm-red focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-dgm-navy transition-colors">
                      <span>Upload a file</span>
                      <input type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                </div>
              </div>
              {file && (
                <div className="mt-4 flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-700 truncate">{file.name}</span>
                  <button 
                    onClick={handleAnalyze} 
                    disabled={analyzing}
                    className="ml-4 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-dgm-navy hover:bg-opacity-90 disabled:opacity-50 transition-all"
                  >
                    {analyzing ? 'Analyzing...' : 'Extract Data'}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gradient-dgm mb-4">Verify & Submit</h3>
              {message.text && (
                <div className={`mb-4 p-3 rounded-lg flex items-start ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  {message.type === 'success' ? <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />}
                  <span className="text-sm">{message.text}</span>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Record Type</label>
                  <select required value={formData.recordType} onChange={e => setFormData({...formData, recordType: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-red focus:border-dgm-red sm:text-sm">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Interpreter ID</label>
                  <input type="text" required readOnly value={formData.interpreterId} onChange={e => setFormData({...formData, interpreterId: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date Range</label>
                  <input type="text" required readOnly value={formData.dateRange} onChange={e => setFormData({...formData, dateRange: e.target.value})} placeholder="e.g. 2023-10-01 to 2023-10-07" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Minutes</label>
                  <input type="number" required readOnly value={formData.totalMinutes} onChange={e => setFormData({...formData, totalMinutes: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Calls</label>
                  <input type="number" required readOnly value={formData.totalCalls} onChange={e => setFormData({...formData, totalCalls: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm" />
                </div>
                <button type="submit" disabled={submitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-dgm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-dgm-red disabled:opacity-50 transition-all">
                  {submitting ? 'Submitting...' : 'Submit Record'}
                </button>
              </form>
            </div>
          </div>

          {/* History Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gradient-dgm">Your Submission History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Submitted</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Range</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Minutes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Calls</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(record.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                          {record.recordType || 'daily'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.dateRange}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.totalMinutes}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.totalCalls}
                        </td>
                      </tr>
                    ))}
                    {records.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                          No records found. Upload a screenshot to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
