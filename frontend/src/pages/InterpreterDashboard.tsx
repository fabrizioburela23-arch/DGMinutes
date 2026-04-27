import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Upload, LogOut, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { checkDateRangeMismatch, getRecordTypeLabel } from '../lib/dateRangeMismatch';
import { apiFetch } from '../lib/api';

type RecordItem = {
  id: string;
  createdAt: string;
  dateRange: string;
  totalMinutes: number;
  totalCalls: number;
  recordType?: 'daily' | 'weekly' | 'monthly';
};

function getErrorMessage(payload: any, fallback: string) {
  return payload?.error || fallback;
}

export default function InterpreterDashboard() {
  const { user, logout, token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    interpreterId: user?.interpreterId || '',
    dateRange: '',
    totalMinutes: '',
    totalCalls: '',
    recordType: 'daily' as 'daily' | 'weekly' | 'monthly',
  });

  const dateRangeMismatch = useMemo(() => {
    return checkDateRangeMismatch(formData.dateRange, formData.recordType);
  }, [formData.dateRange, formData.recordType]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, interpreterId: user?.interpreterId || '' }));
  }, [user?.interpreterId]);

  useEffect(() => {
    if (token) {
      fetchRecords();
    }
  }, [token]);

  const fetchRecords = async () => {
    if (!token) return;

    try {
      const res = await apiFetch('/api/records', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok) {
        setRecords(data.records || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage({ type: '', text: '' });
    }
  };

  const handleAnalyze = async () => {
    if (!file || !token) return;

    setAnalyzing(true);
    setMessage({ type: '', text: '' });

    try {
      const form = new FormData();
      form.append('image', file);

      const res = await apiFetch('/api/analyze-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: getErrorMessage(data, 'Failed to analyze image.') });
        return;
      }

      setFormData((prev) => ({
        ...prev,
        interpreterId: data.data?.interpreterId || user?.interpreterId || '',
        dateRange: data.data?.dateRange || '',
        totalMinutes: String(data.data?.totalMinutes ?? ''),
        totalCalls: String(data.data?.totalCalls ?? ''),
      }));

      setMessage({
        type: 'success',
        text: 'Image analyzed successfully. Review the extracted values and adjust them if necessary before submitting.',
      });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'An error occurred while analyzing the image.' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const totalMinutes = Number(formData.totalMinutes);
    const totalCalls = Number(formData.totalCalls);

    if (!formData.interpreterId || !formData.dateRange || !Number.isFinite(totalMinutes) || !Number.isFinite(totalCalls)) {
      setMessage({ type: 'error', text: 'Complete all fields with valid values before submitting.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await apiFetch('/api/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          interpreterId: formData.interpreterId,
          dateRange: formData.dateRange,
          totalMinutes,
          totalCalls,
          recordType: formData.recordType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: getErrorMessage(data, 'Failed to submit record.') });
        return;
      }

      setMessage({ type: 'success', text: 'Record submitted successfully.' });
      setFormData({
        interpreterId: user?.interpreterId || '',
        dateRange: '',
        totalMinutes: '',
        totalCalls: '',
        recordType: 'daily',
      });
      setFile(null);
      fetchRecords();
    } catch (error) {
      console.error(error);
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
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gradient-dgm mb-4">Upload Screenshot</h3>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-dgm-red transition-colors">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-dgm-navy hover:text-dgm-red focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-dgm-navy transition-colors">
                      <span>Upload an image</span>
                      <input type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, JPEG or GIF up to 10MB</p>
                </div>
              </div>
              {file && (
                <div className="mt-4 flex items-center justify-between bg-gray-50 p-3 rounded-lg gap-3">
                  <span className="text-sm text-gray-700 truncate">{file.name}</span>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-dgm-navy hover:bg-opacity-90 disabled:opacity-50 transition-all"
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
              {dateRangeMismatch && (
                <div className="mb-4 p-3 rounded-lg flex items-start bg-amber-50 border border-amber-200 text-amber-800">
                  <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 text-amber-500" />
                  <div className="text-sm">
                    <p className="font-semibold">Record Type Mismatch</p>
                    <p>{dateRangeMismatch.message}</p>
                  </div>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Record Type</label>
                  <select
                    required
                    value={formData.recordType}
                    onChange={(e) => setFormData({ ...formData, recordType: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-red focus:border-dgm-red sm:text-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Interpreter ID</label>
                  <input
                    type="text"
                    required
                    value={formData.interpreterId}
                    onChange={(e) => setFormData({ ...formData, interpreterId: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date Range</label>
                  <input
                    type="text"
                    required
                    value={formData.dateRange}
                    onChange={(e) => setFormData({ ...formData, dateRange: e.target.value })}
                    placeholder="e.g. 2026-04-01 to 2026-04-07"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Minutes</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.totalMinutes}
                    onChange={(e) => setFormData({ ...formData, totalMinutes: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Calls</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.totalCalls}
                    onChange={(e) => setFormData({ ...formData, totalCalls: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm"
                  />
                </div>
                <button type="submit" disabled={submitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-dgm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-dgm-red disabled:opacity-50 transition-all">
                  {submitting ? 'Submitting...' : 'Submit Record'}
                </button>
              </form>
            </div>
          </div>

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
                    {records.map((record) => {
                      const mismatch = checkDateRangeMismatch(record.dateRange, (record.recordType || 'daily') as 'daily' | 'weekly' | 'monthly');
                      return (
                      <tr key={record.id} className={`hover:bg-gray-50 ${mismatch ? 'bg-amber-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(record.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                          <div className="flex items-center gap-1">
                            {record.recordType || 'daily'}
                            {mismatch && (
                              <span title={mismatch.message} className="text-amber-500 cursor-help">
                                <AlertTriangle className="h-4 w-4" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          <div>{record.dateRange}</div>
                          {mismatch && (
                            <div className="text-xs text-amber-600 mt-1 font-normal">
                              ⚠️ Looks like {getRecordTypeLabel(mismatch.detectedType)} ({mismatch.days} days)
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.totalMinutes}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.totalCalls}
                        </td>
                      </tr>);
                    })}
                    {records.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                          No records found. Upload a screenshot or enter the values manually to get started.
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
