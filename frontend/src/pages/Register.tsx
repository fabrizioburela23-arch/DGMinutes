import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Globe, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: '',
    interpreterId: '',
    platform: '',
    primaryContact: '',
    secondaryContact: '',
    email: '',
    password: '',
    role: 'interpreter'
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [masterCount, setMasterCount] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch('/api/auth/master-count')
      .then(res => res.json())
      .then(data => {
        setMasterCount(data.count || 0);
        if (data.count >= 3 && formData.role === 'master') {
          setFormData(prev => ({ ...prev, role: 'interpreter' }));
        }
      })
      .catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        login(data.token, data.user);
        navigate(data.user.role === 'master' ? '/master' : '/dashboard');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex flex-col items-center justify-center">
            <Globe className="h-12 w-12 text-dgm-navy mb-2" strokeWidth={1.5} />
            <h1 className="text-5xl font-black text-gradient-dgm tracking-tighter">DGM</h1>
          </div>
          <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input name="fullName" type="text" required className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm" onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interpreter ID</label>
              <input name="interpreterId" type="text" required className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm" onChange={handleChange} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['C-Tel', 'Simplified', 'Interprepedia'].map((plat) => (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setFormData({ ...formData, platform: plat })}
                    className={`py-2 px-4 text-sm font-medium rounded-lg border transition-colors ${
                      formData.platform === plat
                        ? 'bg-dgm-navy text-white border-dgm-navy'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>
              <input type="hidden" name="platform" value={formData.platform} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select name="role" className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm" onChange={handleChange} value={formData.role}>
                <option value="interpreter">Interpreter</option>
                {masterCount < 3 && <option value="master">Master</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Contact</label>
              <input name="primaryContact" type="text" required className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm" onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Contact</label>
              <input name="secondaryContact" type="text" className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm" onChange={handleChange} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input name="email" type="email" required className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm" onChange={handleChange} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input name="password" type={showPassword ? "text" : "password"} required className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-dgm-navy focus:border-dgm-navy sm:text-sm pr-10" onChange={handleChange} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-dgm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-dgm-navy transition-all"
            >
              Register
            </button>
          </div>
          <div className="text-center text-sm">
            <span className="text-gray-600">Already have an account? </span>
            <Link to="/login" className="font-medium text-dgm-red hover:text-dgm-navy transition-colors">
              Sign in here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
