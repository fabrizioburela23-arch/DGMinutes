import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Users, FileText, BarChart3 } from 'lucide-react';

export default function MasterDashboard() {
  const { user, logout, token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'interpreters' | 'records'>('overview');
  const [searchName, setSearchName] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, recordsRes] = await Promise.all([
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/records', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users.filter((u: any) => u.role === 'interpreter'));
      }
      if (recordsRes.ok) {
        const recordsData = await recordsRes.json();
        setRecords(recordsData.records);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchName = u.fullName.toLowerCase().includes(searchName.toLowerCase());
    const matchPlatform = filterPlatform ? u.platform === filterPlatform : true;
    return matchName && matchPlatform;
  });

  const filteredRecords = records.filter(r => {
    const recordUser = users.find(u => u.interpreterId === r.interpreterId);
    const platform = recordUser?.platform || '';
    const matchName = r.username.toLowerCase().includes(searchName.toLowerCase());
    const matchPlatform = filterPlatform ? platform === filterPlatform : true;
    const matchDate = (() => {
      if (!filterStartDate && !filterEndDate) return true;
      const recordDate = new Date(r.createdAt).toISOString().split('T')[0];
      if (filterStartDate && filterEndDate) return recordDate >= filterStartDate && recordDate <= filterEndDate;
      if (filterStartDate) return recordDate >= filterStartDate;
      if (filterEndDate) return recordDate <= filterEndDate;
      return true;
    })();
    return matchName && matchPlatform && matchDate;
  });

  const overviewMinutes = filteredRecords.reduce((sum, r) => sum + r.totalMinutes, 0);
  const overviewCalls = filteredRecords.reduce((sum, r) => sum + r.totalCalls, 0);

  const groupedByDate = filteredRecords.filter(r => r.recordType === 'daily' || !r.recordType).reduce((acc: any, r) => {
    const date = r.dateRange || new Date(r.createdAt).toISOString().split('T')[0];
    if (!acc[date]) acc[date] = { minutes: 0, calls: 0, date };
    acc[date].minutes += r.totalMinutes;
    acc[date].calls += r.totalCalls;
    return acc;
  }, {});
  const dailyStats = Object.values(groupedByDate).sort((a: any, b: any) => b.date.localeCompare(a.date));

  const groupedByWeek = filteredRecords.filter(r => r.recordType === 'weekly').reduce((acc: any, r) => {
    const date = r.dateRange; // Using dateRange for week identifier
    if (!acc[date]) acc[date] = { minutes: 0, calls: 0, date };
    acc[date].minutes += r.totalMinutes;
    acc[date].calls += r.totalCalls;
    return acc;
  }, {});
  const weeklyStats = Object.values(groupedByWeek).sort((a: any, b: any) => b.date.localeCompare(a.date));

  const groupedByMonth = filteredRecords.filter(r => r.recordType === 'monthly').reduce((acc: any, r) => {
    const date = r.dateRange; // Using dateRange for month identifier
    if (!acc[date]) acc[date] = { minutes: 0, calls: 0, date };
    acc[date].minutes += r.totalMinutes;
    acc[date].calls += r.totalCalls;
    return acc;
  }, {});
  const monthlyStats = Object.values(groupedByMonth).sort((a: any, b: any) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="font-black text-3xl text-gradient-dgm tracking-tighter mr-3">DGM</span>
              <span className="font-medium text-lg text-gray-900 border-l-2 border-gray-200 pl-3">Master Dashboard</span>
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
        
        <div className="mb-8 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview' ? 'border-dgm-red text-dgm-navy' : 'border-transparent text-gray-500 hover:text-dgm-navy hover:border-gray-300'}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('interpreters')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'interpreters' ? 'border-dgm-red text-dgm-navy' : 'border-transparent text-gray-500 hover:text-dgm-navy hover:border-gray-300'}`}
            >
              Interpreters
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'records' ? 'border-dgm-red text-dgm-navy' : 'border-transparent text-gray-500 hover:text-dgm-navy hover:border-gray-300'}`}
            >
              All Records
            </button>
          </nav>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Search by Name</label>
            <input type="text" placeholder="Enter name..." value={searchName} onChange={e => setSearchName(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Platform</label>
            <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm">
              <option value="">All Platforms</option>
              <option value="C-Tel">C-Tel</option>
              <option value="Simplified">Simplified</option>
              <option value="Interprepedia">Interprepedia</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Date Range</label>
            <div className="flex space-x-2">
              <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm" placeholder="Start" />
              <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm" placeholder="End" />
            </div>
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="bg-white overflow-hidden shadow-sm rounded-2xl border border-gray-100">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-6 w-6 text-dgm-red" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Interpreters</dt>
                        <dd className="text-3xl font-bold text-gradient-dgm">{filteredUsers.length}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white overflow-hidden shadow-sm rounded-2xl border border-gray-100">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <FileText className="h-6 w-6 text-dgm-red" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Minutes Logged</dt>
                        <dd className="text-3xl font-bold text-gradient-dgm">{overviewMinutes}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white overflow-hidden shadow-sm rounded-2xl border border-gray-100">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <BarChart3 className="h-6 w-6 text-dgm-red" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Calls</dt>
                        <dd className="text-3xl font-bold text-gradient-dgm">{overviewCalls}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gradient-dgm">Daily Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Minutes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Calls</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dailyStats.map((stat: any) => (
                      <tr key={stat.date} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stat.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.minutes}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.calls}</td>
                      </tr>
                    ))}
                    {dailyStats.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-500">No daily records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gradient-dgm">Weekly Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Week Range</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Minutes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Calls</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {weeklyStats.map((stat: any) => (
                      <tr key={stat.date} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stat.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.minutes}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.calls}</td>
                      </tr>
                    ))}
                    {weeklyStats.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-500">No weekly records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gradient-dgm">Monthly Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month Range</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Minutes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Calls</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {monthlyStats.map((stat: any) => (
                      <tr key={stat.date} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stat.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.minutes}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.calls}</td>
                      </tr>
                    ))}
                    {monthlyStats.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-500">No monthly records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'interpreters' && (
          <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gradient-dgm">Registered Interpreters</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.fullName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.interpreterId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.platform}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.primaryContact}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gradient-dgm">All Operational Records</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Submitted</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interpreter</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Range</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Minutes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Calls</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {record.recordType || 'daily'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.interpreterId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
