import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Plus, 
  Camera, 
  History, 
  AlertTriangle, 
  User, 
  LogOut, 
  Shield, 
  Stethoscope, 
  Phone, 
  Bell,
  Brain,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Cloud,
  Dna,
  Droplets,
  Edit,
  FileText,
  FlaskConical,
  Heart,
  Mic,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Languages,
  Volume2,
  Send,
  MessageSquare,
  Thermometer,
  Weight,
  UserPlus,
  ShieldAlert,
  Smile,
  X,
  Trash2,
  Lock,
  Unlock,
  Video,
  Package,
  CreditCard,
  Users,
  Wind,
  Zap,
  Cpu,
  Layers,
  Microscope,
  Radio,
  Sun,
  Map,
  Apple,
  Bug,
  Eye,
  Bot,
  Atom,
  Database,
  Sparkles,
  Fingerprint,
  HardDrive
} from 'lucide-react';
import { GlassCard, NeonButton, VirtualLogo, StatusBanner } from './components/UI';
import { User as UserType, Patient, Prescription, Vital, Alert, Medicine, PrivateData } from './types';
import { 
  extractPrescriptionData, 
  analyzeDrugSafety, 
  predictHealthRisks, 
  explainPrescriptionSimple, 
  chatWithAssistant, 
  generateSpeech,
  analyzeClinicalRisk,
  detectDiseasePatterns,
  voicePrescriptionToDigital,
  extractMedicalDocumentData,
  testAIConnection
} from './services/geminiService';

const getLangCode = (lang: string) => {
  const codes: any = {
    'English': 'en-US',
    'Tamil': 'ta-IN',
    'Hindi': 'hi-IN',
    'Telugu': 'te-IN',
    'Kannada': 'kn-IN',
    'Malayalam': 'ml-IN',
    'Bengali': 'bn-IN',
    'Marathi': 'mr-IN',
    'Gujarati': 'gu-IN',
    'Punjabi': 'pa-IN'
  };
  return codes[lang] || 'en-US';
};

export default function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [view, setView] = useState<'dashboard' | 'profile' | 'scan' | 'vitals' | 'intake' | 'doc_scan' | 'lab_scan' | 'appointment_form' | 'private_vault' | 'pending_labs'>('dashboard');
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [scanMode, setScanMode] = useState<'upload' | 'voice'>('upload');
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState({ totalPatients: 0, todayVisits: 0, activeCases: 0 });
  const [authData, setAuthData] = useState({ username: '', password: '', name: '', role: 'doctor' as 'doctor' | 'nurse' | 'patient', hospitalCode: '' });
  const [language, setLanguage] = useState('English');
  const [portal, setPortal] = useState<'doctor' | 'nurse' | 'patient' | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [pendingLabs, setPendingLabs] = useState(0);
  const [pendingLabsData, setPendingLabsData] = useState<any[]>([]);
  const [scanInitialPatient, setScanInitialPatient] = useState<any>(null);
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);

  const languages = [
    'English', 'Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi'
  ];

  useEffect(() => {
    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      setConfigError("Gemini API Key is missing. AI features like Prescription Scanning will not work. Please set your key in the AI Studio Secrets panel.");
    } else {
      // Test the key
      testAIConnection().then(res => {
        if (!res.success) {
          setConfigError(`AI Connection Failed: ${res.error}. Please verify your GEMINI_API_KEY in the Secrets panel.`);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchPatients();
      fetchStats();
      fetchPendingLabs();
      fetchRecentActivity();
    }
  }, [user]);

  useEffect(() => {
    if (!offlineMode && user) {
      syncOfflineData();
    }
  }, [offlineMode, user]);

  const syncOfflineData = async () => {
    const offlineIntake = JSON.parse(localStorage.getItem('offlineIntake') || '[]');
    const offlinePrescriptions = JSON.parse(localStorage.getItem('offlinePrescriptions') || '[]');
    const offlinePatients = JSON.parse(localStorage.getItem('offlinePatients') || '[]');
    const offlineScans = JSON.parse(localStorage.getItem('offlineScans') || '[]');

    if (offlineIntake.length === 0 && offlinePrescriptions.length === 0 && offlinePatients.length === 0 && offlineScans.length === 0) return;

    setLoading(true);
    const patientIdMap: Record<string, number> = {};

    try {
      // Sync Patients first
      for (const patient of offlinePatients) {
        const tempId = patient.id;
        try {
          const res = await fetch('/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patient)
          });
          
          if (res.ok) {
            const data = await res.json();
            patientIdMap[tempId] = data.id;

            // Also store in private data vault for security
            const content = `NEW PATIENT REGISTRATION (Synced)
----------------------------
Patient: ${patient.name}
Age: ${patient.age}
Phone: ${patient.phone}
Blood Group: ${patient.blood_group}
Allergies: ${patient.allergies}
Chronic Conditions: ${patient.chronic_conditions}
Past Illness: ${patient.past_illness}`;

            await fetch('/api/private-data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                staff_id: user?.id || 'STAFF001',
                staff_name: user?.name || 'Nurse Meena',
                content: content
              })
            });
          } else {
            // If patient already exists (e.g. unique phone), try to find them
            const searchRes = await fetch(`/api/patients/search?query=${encodeURIComponent(patient.phone)}`);
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              if (searchData.length > 0) {
                patientIdMap[tempId] = searchData[0].id;
              }
            }
          }
        } catch (e) {
          console.error('Error syncing patient:', e);
        }
      }

      // Sync Scans (Delayed OCR)
      for (const scan of offlineScans) {
        try {
          const realPatientId = scan.patient_id ? (patientIdMap[scan.patient_id] || scan.patient_id) : null;
          
          // 1. Extract data from image
          const extracted = await extractPrescriptionData(scan.image_data);
          
          // 2. Save prescription
          await fetch('/api/prescriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patient_id: realPatientId || 1, // Default to 1 if no patient
              doctor_name: scan.staff_name,
              symptoms: extracted.symptoms,
              medicines: extracted.medicines,
              date: new Date().toISOString(),
              image_data: scan.image_data
            })
          });
        } catch (e) {
          console.error('Error syncing scan:', e);
        }
      }

      // Sync Vitals
      for (const intake of offlineIntake) {
        try {
          // Map temp ID to real ID if available
          const realPatientId = patientIdMap[intake.patient_id] || intake.patient_id;
          
          const res = await fetch('/api/vitals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...intake,
              patient_id: realPatientId
            })
          });

          if (res.ok) {
            // Also store in private data vault for security
            const content = `PATIENT INTAKE RECORD (Synced)
----------------------------
Patient: ${intake.patient_name || 'N/A'}
ID: ${realPatientId}
BP: ${intake.bp}
Weight: ${intake.weight} kg
Blood Group: ${intake.blood_group}
Phone: ${intake.phone}
Symptoms: ${intake.symptoms}
Notes: ${intake.notes}
Recorded By: ${intake.recorded_by}`;

            await fetch('/api/private-data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                staff_id: user?.id || 'STAFF001',
                staff_name: user?.name || 'Nurse Meena',
                content: content
              })
            });
          }
        } catch (e) {
          console.error('Error syncing vitals:', e);
        }
      }

      // Sync Prescriptions
      for (const prescription of offlinePrescriptions) {
        try {
          await fetch('/api/private-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prescription)
          });
        } catch (e) {
          console.error('Error syncing prescription:', e);
        }
      }

      // Clear offline data after sync
      localStorage.removeItem('offlineIntake');
      localStorage.removeItem('offlinePrescriptions');
      localStorage.removeItem('offlinePatients');
      localStorage.removeItem('offlineScans');
      
      fetchPatients();
      fetchStats();
      fetchRecentActivity();
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingLabs = async () => {
    if (offlineMode) return;
    try {
      const res = await fetch('/api/pending-lab-results');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPendingLabsData(data);
        setPendingLabs(data.length);
      }
    } catch (error) {
      console.error('Error fetching pending labs:', error);
    }
  };

  const fetchRecentActivity = async () => {
    if (offlineMode) return;
    try {
      const res = await fetch('/api/recent-activity');
      const data = await res.json();
      setRecentActivity(data);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const fetchPatients = async () => {
    if (offlineMode) {
      const offlinePatients = JSON.parse(localStorage.getItem('offlinePatients') || '[]');
      const mockPatients = [
        { id: 101, name: 'Ramesh Kumar', age: 45, phone: '9876543210', allergies: 'Penicillin', created_at: new Date().toISOString() },
        { id: 102, name: 'Sita Devi', age: 38, phone: '9876543211', allergies: 'None', created_at: new Date().toISOString() },
        { id: 103, name: 'Abdul Khan', age: 52, phone: '9876543212', allergies: 'Sulfa', created_at: new Date().toISOString() }
      ];
      setPatients([...offlinePatients, ...mockPatients]);
      return;
    }
    const res = await fetch('/api/patients');
    const data = await res.json();
    setPatients(data);
  };

  const fetchStats = async () => {
    if (offlineMode) {
      setStats({ totalPatients: 124, todayVisits: 8, activeCases: 12 });
      return;
    }
    const url = user?.role === 'doctor' ? `/api/stats?doctor_name=${encodeURIComponent(user.name)}` : '/api/stats';
    const res = await fetch(url);
    const data = await res.json();
    setStats(data);
    if (data.pendingLabs !== undefined) setPendingLabs(data.pendingLabs);
    if (data.todayAppointments !== undefined) setTodayAppointmentsCount(data.todayAppointments);
    fetchRecentActivity();
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (authMode === 'register' && (authData.role === 'doctor' || authData.role === 'nurse')) {
      if (authData.hospitalCode !== 'inba123') {
        alert('Invalid Hospital Code. Access Denied.');
        return;
      }
    }

    if (offlineMode) {
      setLoading(true);
      setTimeout(() => {
        if (authMode === 'login') {
          setUser({
            username: authData.username,
            name: authData.name || (authData.role === 'doctor' ? 'Dr. Sharma' : authData.role === 'nurse' ? 'Nurse Joy' : 'Patient Ramesh'),
            role: authData.role
          });
        } else {
          alert('Offline Registration successful! Please login.');
          setAuthMode('login');
        }
        setLoading(false);
      }, 800);
      return;
    }

    setLoading(true);
    const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData),
      });
      const data = await res.json();
      if (res.ok) {
        if (authMode === 'register') {
          alert('Registration successful! Please login.');
          setAuthMode('login');
        } else {
          setUser(data);
        }
      } else {
        alert(data.error || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const [profileInitialTab, setProfileInitialTab] = useState<'timeline' | 'vitals' | 'alerts' | 'insights' | 'private'>('timeline');

  const selectPatient = async (id: number, initialTab: 'timeline' | 'vitals' | 'alerts' | 'insights' | 'private' = 'timeline') => {
    setLoading(true);
    try {
      if (offlineMode) {
        const p = patients.find(p => p.id === id);
        if (p) {
          setSelectedPatient(p);
          setProfileInitialTab(initialTab);
          setView('profile');
        } else {
          alert('Patient not found in offline records.');
        }
      } else {
        const res = await fetch(`/api/patients/${id}`);
        const data = await res.json();
        if (res.ok) {
          setSelectedPatient(data);
          setProfileInitialTab(initialTab);
          setView('profile');
        } else {
          alert(data.error || 'Patient not found. Please ensure the Patient ID is correct.');
        }
      }
    } catch (error) {
      alert('Error fetching patient profile.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
        
        <GlassCard className="w-full max-w-md relative z-10">
          <div className="flex flex-col items-center mb-8">
            <VirtualLogo className="mb-4" />
            <p className="text-white/50 text-sm">Digitizing Rural Healthcare with AI</p>
          </div>
          
          {!portal ? (
            <div className="space-y-4">
              <h2 className="text-center text-lg font-bold mb-6 text-white/80">Select Your Portal</h2>
              <button 
                onClick={() => { 
                  setPortal('doctor'); 
                  setAuthData({ username: '', password: '', name: '', role: 'doctor', hospitalCode: '' });
                  setAuthMode('login');
                }}
                className="w-full p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-4 group"
              >
                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                  <Stethoscope size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-emerald-400">Doctor Login</p>
                  <p className="text-xs text-white/40">Access prescriptions & records</p>
                </div>
                <ChevronRight size={20} className="ml-auto text-white/20" />
              </button>

              <button 
                onClick={() => { 
                  setPortal('nurse'); 
                  setAuthData({ username: '', password: '', name: '', role: 'nurse', hospitalCode: '' });
                  setAuthMode('login');
                }}
                className="w-full p-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-4 group"
              >
                <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
                  <Activity size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-blue-400">Nurse Login</p>
                  <p className="text-xs text-white/40">Manage vitals & patient intake</p>
                </div>
                <ChevronRight size={20} className="ml-auto text-white/20" />
              </button>

              <button 
                onClick={() => { 
                  setPortal('patient'); 
                  setAuthData({ username: '', password: '', name: '', role: 'patient', hospitalCode: '' });
                  setAuthMode('login');
                }}
                className="w-full p-6 rounded-2xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center gap-4 group"
              >
                <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform">
                  <User size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-purple-400">Patient Login</p>
                  <p className="text-xs text-white/40">View your records & prescriptions</p>
                </div>
                <ChevronRight size={20} className="ml-auto text-white/20" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setPortal(null)} className="p-2 hover:bg-white/5 rounded-lg text-white/40">
                  <ArrowLeft size={18} />
                </button>
                <h2 className="font-bold text-white/80 capitalize">{portal} Portal</h2>
              </div>

              <div className="flex gap-4 mb-6 p-1 bg-white/5 rounded-xl">
                <button 
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/40 hover:text-white'}`}
                >
                  Login
                </button>
                <button 
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${authMode === 'register' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/40 hover:text-white'}`}
                >
                  Register
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'register' && (
                  <>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={authData.name}
                        onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all"
                        placeholder={
                          authData.role === 'doctor' ? "Dr. Sharma" : 
                          authData.role === 'nurse' ? "Nurse Meena" : 
                          "Ramesh Kumar"
                        }
                      />
                    </div>
                    {(authData.role === 'doctor' || authData.role === 'nurse') && (
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Hospital Code</label>
                        <input
                          type="text"
                          required
                          value={authData.hospitalCode}
                          onChange={(e) => setAuthData({ ...authData, hospitalCode: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all"
                          placeholder="Enter hospital code"
                        />
                      </div>
                    )}
                  </>
                )}
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">
                    {authData.role === 'patient' ? 'Username' : authData.role === 'doctor' ? 'Doctor Staff ID' : 'Nurse Staff ID'}
                  </label>
                  <input
                    type="text"
                    required
                    value={authData.username}
                    onChange={(e) => setAuthData({ ...authData, username: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all"
                    placeholder={
                      authData.role === 'doctor' ? "e.g. DR023" : 
                      authData.role === 'nurse' ? "e.g. NR001" : 
                      "e.g. ramesh_k"
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Password</label>
                  <input
                    type="password"
                    required
                    value={authData.password}
                    onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <NeonButton className="w-full py-4 mt-4" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin mx-auto" /> : authMode === 'login' ? 'Access Portal' : 'Create Account'}
                </NeonButton>
              </form>
            </>
          )}
          
          <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-3">
            <p className="text-white/30 text-[10px] uppercase tracking-widest italic">Demo: admin / admin123</p>
            <p className="text-white/30 text-[10px] uppercase tracking-widest">Authorized Access Only</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <VirtualLogo onClick={() => setView('dashboard')} className="cursor-pointer" />
          {user.role !== 'patient' && (
            <nav className="hidden md:flex items-center gap-6">
              <button 
                onClick={() => setView('dashboard')}
                className={`text-sm font-medium transition-all ${view === 'dashboard' ? 'text-emerald-400' : 'text-white/50 hover:text-white'}`}
              >
                Dashboard
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${offlineMode ? 'text-orange-400' : 'text-emerald-400'}`}>
                  {offlineMode ? 'Offline' : 'Online'}
                </span>
                <button 
                  onClick={() => {
                    const newMode = !offlineMode;
                    setOfflineMode(newMode);
                    localStorage.setItem('offlineMode', String(newMode));
                  }}
                  className={`relative w-8 h-4 rounded-full transition-all ${offlineMode ? 'bg-orange-500/40' : 'bg-emerald-500/40'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${offlineMode ? 'left-4.5' : 'left-0.5'}`} />
                </button>
              </div>
            </nav>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-white/40">{user.role}</p>
          </div>
          <button 
            onClick={() => setUser(null)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/50 transition-all"
          >
            <LogOut size={18} className="text-white/60" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {configError && (
          <StatusBanner 
            type="error" 
            message={configError} 
            action={{ label: "Retry Connection", onClick: () => {
              setConfigError(null);
              testAIConnection().then(res => {
                if (!res.success) {
                  setConfigError(`AI Connection Failed: ${res.error}. Please verify your GEMINI_API_KEY in the Secrets panel.`);
                } else {
                  alert("AI Connection Successful! Features are now active.");
                }
              });
            }}}
          />
        )}
        {user.role === 'patient' ? (
          <PatientDashboard user={user} language={language} setLanguage={setLanguage} languages={languages} />
        ) : (
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
                  </div>
                  <p className="text-white/50">Welcome back, {user.name.split(' ')[0]}</p>
                </div>
                <div className="flex gap-3">
                  <NeonButton onClick={() => setView('private_vault')} variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                    <Shield size={18} className="mr-2 inline" /> Private Data ➝
                  </NeonButton>
                  {user.role === 'patient' && (
                    <NeonButton onClick={() => setView('scan')}>
                      <Camera size={18} className="mr-2 inline" /> New Scan
                    </NeonButton>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="flex items-center gap-4 border-emerald-500/20">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <User size={24} />
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-widest">Total Patients</p>
                    <p className="text-2xl font-bold">{stats.totalPatients}</p>
                  </div>
                </GlassCard>
                <GlassCard className="flex items-center gap-4 border-blue-500/20">
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-widest">Today's Visits</p>
                    <p className="text-2xl font-bold">{stats.todayVisits}</p>
                  </div>
                </GlassCard>
                <GlassCard className="flex items-center gap-4 border-red-500/20">
                  <div className="p-3 rounded-xl bg-red-500/10 text-red-400">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-widest">Active Cases</p>
                    <p className="text-2xl font-bold">{stats.activeCases}</p>
                  </div>
                </GlassCard>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {/* Quick Overview Panel */}
                <div className="space-y-6">
                  <GlassCard hover={false}>
                    <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {user.role === 'doctor' && (
                        <>
                          <button 
                            onClick={() => { setView('scan'); setScanMode('upload'); }}
                            className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center hover:bg-emerald-500/20 transition-all"
                          >
                            <Camera size={24} className="mx-auto mb-2 text-emerald-400" />
                            <span className="text-xs font-medium">Scan Rx</span>
                          </button>
                          <button 
                            onClick={() => { setView('scan'); setScanMode('voice'); }}
                            className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center hover:bg-blue-500/20 transition-all"
                          >
                            <Mic size={24} className="mx-auto mb-2 text-blue-400" />
                            <span className="text-xs font-medium">Voice Rx</span>
                          </button>
                        </>
                      )}
                      {user.role === 'nurse' && (
                        <>
                          <button 
                            onClick={() => { setView('scan'); setScanMode('upload'); }}
                            className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center hover:bg-emerald-500/20 transition-all"
                          >
                            <Camera size={24} className="mx-auto mb-2 text-emerald-400" />
                            <span className="text-xs font-medium">Scan Rx</span>
                          </button>
                          <button 
                            onClick={() => setView('vitals')}
                            className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center hover:bg-blue-500/20 transition-all"
                          >
                            <ClipboardList size={24} className="mx-auto mb-2 text-blue-400" />
                            <span className="text-xs font-medium">Intake Mode</span>
                          </button>
                          <button 
                            onClick={() => setView('lab_scan')}
                            className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center hover:bg-purple-500/20 transition-all"
                          >
                            <FlaskConical size={24} className="mx-auto mb-2 text-purple-400" />
                            <span className="text-xs font-medium">Scan Lab Report</span>
                          </button>
                          <button 
                            onClick={() => setView('appointment_form')}
                            className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center hover:bg-amber-500/20 transition-all"
                          >
                            <Calendar size={24} className="mx-auto mb-2 text-amber-400" />
                            <span className="text-xs font-medium">Add Appointment</span>
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => setView('private_vault')}
                        className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center hover:bg-red-500/20 transition-all col-span-2"
                      >
                        <AlertTriangle size={24} className="mx-auto mb-2 text-red-400" />
                        <span className="text-xs font-medium">Emergency Search</span>
                      </button>
                    </div>
                  </GlassCard>

                  {user.role === 'doctor' && (
                    <GlassCard hover={false} className="border-blue-500/20">
                      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Clock size={18} className="text-blue-400" /> Quick Overview
                      </h2>
                      <div className="space-y-5">
                        {/* Lab Results Pending Review */}
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Pending Lab Result</p>
                          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FlaskConical size={14} className="text-blue-400" />
                              <div>
                                <p className="text-xs font-bold">{pendingLabs} Pending Lab Result</p>
                                <p className="text-[8px] text-white/40">3 Critical - Needs Immediate Review</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setView('pending_labs')}
                              className="text-[10px] text-blue-400 uppercase font-bold hover:underline"
                            >
                              View All
                            </button>
                          </div>
                        </div>

                        {/* Pending Appointments */}
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Today Appointments</p>
                          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-emerald-400" />
                              <div>
                                <p className="text-xs font-bold">{todayAppointmentsCount < 10 ? `0${todayAppointmentsCount}` : todayAppointmentsCount} Today Appointments</p>
                                <p className="text-[8px] text-white/40">Next: 10:30 AM (Patient #204)</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setView('appointments')}
                              className="text-[10px] text-emerald-400 uppercase font-bold hover:underline"
                            >
                              View All
                            </button>
                          </div>
                        </div>

                        {/* Recent Activity */}
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Recent Activity</p>
                          <div className="space-y-2">
                            {recentActivity.length === 0 ? (
                              <p className="text-[10px] text-white/20 italic">No recent activity</p>
                            ) : (
                              recentActivity.map((activity, idx) => (
                                <div key={idx} className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-start gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                                    activity.type === 'prescription' ? 'bg-emerald-400' :
                                    activity.type === 'vitals' ? 'bg-blue-400' :
                                    activity.type === 'lab' ? 'bg-purple-400' :
                                    'bg-amber-400'
                                  }`} />
                                  <div>
                                    <p className="text-[10px] font-medium">{activity.message}</p>
                                    <p className="text-[8px] text-white/40">{new Date(activity.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  )}
                </div>
              </div>
            </motion.div>
          )}

            {view === 'profile' && selectedPatient && (
              <PatientProfile 
                patient={selectedPatient} 
                user={user}
                onBack={() => setView('dashboard')} 
                onScan={() => {
                  setScanInitialPatient(selectedPatient);
                  setView('scan');
                }}
                onVitals={() => setView('vitals')}
                initialTab={profileInitialTab}
              />
            )}

          {view === 'scan' && (
            <PrescriptionScanner 
              user={user}
              patientId={selectedPatient?.id}
              initialMode={scanMode}
              offlineMode={offlineMode}
              onComplete={(data) => {
                if (selectedPatient) selectPatient(selectedPatient.id);
                else setView('dashboard');
                fetchStats();
              }}
              onCancel={() => setView('dashboard')}
            />
          )}

          {view === 'doc_scan' && (
            <MedicalDocumentScanner 
              user={user}
              onComplete={() => {
                setView('dashboard');
                fetchPatients();
                fetchStats();
              }}
              onCancel={() => setView('dashboard')}
            />
          )}

          {view === 'lab_scan' && (
            <LabReportScanner 
              user={user} 
              initialPatient={scanInitialPatient}
              onComplete={() => {
                setView('dashboard');
                setScanInitialPatient(null);
                fetchPendingLabs();
              }} 
              onCancel={() => {
                setView('dashboard');
                setScanInitialPatient(null);
              }} 
            />
          )}

          {view === 'appointment_form' && (
            <AppointmentForm 
              onComplete={() => {
                fetchStats();
                setView('dashboard');
              }}
              onCancel={() => setView('dashboard')}
            />
          )}

          {view === 'appointments' && (
            <TodayAppointments 
              user={user}
              onBack={() => setView('dashboard')}
            />
          )}

          {view === 'vitals' && (
            <VitalsForm 
              patient={selectedPatient}
              user={user}
              onComplete={() => {
                if (selectedPatient) selectPatient(selectedPatient.id);
                else setView('dashboard');
                fetchStats();
              }}
              onCancel={() => setView('dashboard')}
            />
          )}

          {view === 'intake' && (
            <PatientIntakeForm 
              user={user}
              onComplete={(id) => {
                selectPatient(id);
                fetchPatients();
                fetchStats();
              }}
              onCancel={() => setView('dashboard')}
            />
          )}

          {view === 'private_vault' && (
            <PrivateVault 
              user={user} 
              unlocked={vaultUnlocked} 
              setUnlocked={setVaultUnlocked} 
              onBack={() => { setView('dashboard'); setSelectedPatient(null); }} 
              onSelectPatient={selectPatient}
              filterPatientId={selectedPatient?.id}
            />
          )}

          {view === 'pending_labs' && (
            <PendingLabsReview 
              user={user}
              onBack={() => setView('dashboard')}
              onApprove={() => {
                fetchPendingLabs();
                fetchStats();
              }}
            />
          )}
        </AnimatePresence>
      )}
      </main>
    </div>
  );
}

function PatientDashboard({ user, language, setLanguage, languages }: { user: UserType, language: string, setLanguage: (l: string) => void, languages: string[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20 relative"
    >
      {/* Floating Glow Orbs */}
      <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] bg-emerald-500/5 blur-[100px] rounded-full -z-10" />
      <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full -z-10" />

      {/* Top Section: Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-bold tracking-tight neon-text"
          >
            Welcome, {user.name.split(' ')[0]}
          </motion.h1>
          <p className="text-white/50 mt-1">Your personal AI health companion is ready.</p>
        </div>
        
        {/* Language Selector */}
        <GlassCard className="py-2 px-4 flex items-center gap-3 border-emerald-500/30" hover={false}>
          <Languages size={18} className="text-emerald-400" />
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-transparent text-sm font-medium outline-none cursor-pointer text-white/80"
          >
            {languages.map(lang => (
              <option key={lang} value={lang} className="bg-zinc-900">{lang}</option>
            ))}
          </select>
        </GlassCard>
      </div>

      {/* Center Section: Prescription Scanner */}
      <div className="grid grid-cols-1 gap-8">
        <PatientPrescriptionScanner language={language} />
      </div>

      {/* Bottom Section: AI Assistant Chat */}
      <div className="grid grid-cols-1 gap-8">
        <AIHealthChat user={user} language={language} />
      </div>
    </motion.div>
  );
}

function PatientPrescriptionScanner({ language }: { language: string }) {
  const [scanning, setScanning] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const speak = async (text: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    try {
      const audioData = await generateSpeech(text);
      if (audioData) {
        const audio = new Audio(`data:audio/wav;base64,${audioData}`);
        audioRef.current = audio;
        audio.playbackRate = 1.2;
        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
        };
        audio.play();
      } else {
        throw new Error("No audio data");
      }
    } catch (error) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = getLangCode(language);
      utterance.rate = 1.2;
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setExplanation(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const result = reader.result as string;
        if (!result) throw new Error("Failed to read file");
        
        const base64 = result.split(',')[1];
        const data = await extractPrescriptionData(base64);
        
        if (data && data.medicines && Array.isArray(data.medicines)) {
          const simpleExplanation = await explainPrescriptionSimple(data.medicines, language);
          setExplanation(simpleExplanation);
        } else {
          setExplanation("Could not extract medicine details from this image. Please try a clearer photo.");
        }
      } catch (error: any) {
        console.error("Prescription processing error:", error);
        alert(error.message || "Failed to process prescription. Please try again with a clearer image.");
      } finally {
        setScanning(false);
      }
    };
    reader.onerror = () => {
      console.error("FileReader error");
      setScanning(false);
      alert("Failed to read the file.");
    };
    reader.readAsDataURL(file);
  };

  return (
    <GlassCard className="relative overflow-hidden border-emerald-500/20" hover={false}>
      <div className="absolute top-0 right-0 p-4">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
      </div>
      
      <div className="flex flex-col items-center text-center py-8">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/30">
          <Camera size={40} className="text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Prescription Scanner</h2>
        <p className="text-white/50 mb-8 max-w-md">
          Scan your doctor's handwritten prescription to get a simple explanation in {language}.
        </p>
        
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleUpload}
        />
        
        <NeonButton 
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          className="px-12 py-4 text-lg"
        >
          {scanning ? <Loader2 className="animate-spin" /> : "📷 Scan Prescription"}
        </NeonButton>
      </div>

      {explanation && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-8 p-6 bg-emerald-500/5 border-t border-emerald-500/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-emerald-400" size={20} />
              <h3 className="font-bold uppercase tracking-widest text-xs text-emerald-400">AI Explanation</h3>
            </div>
            <button 
              onClick={() => speak(explanation)}
              className={`p-2 rounded-lg border transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest ${
                isSpeaking 
                  ? 'bg-red-500/20 border-red-500/50 text-red-400' 
                  : 'bg-white/5 border border-white/10 text-white/40 hover:text-emerald-400 hover:border-emerald-500/30'
              }`}
            >
              {isSpeaking ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />} 
              {isSpeaking ? 'Stop' : 'Listen'}
            </button>
          </div>
          <div className="prose prose-invert max-w-none text-white/80 leading-relaxed whitespace-pre-wrap">
            {explanation}
          </div>
        </motion.div>
      )}
    </GlassCard>
  );
}

function AIHealthChat({ user, language }: { user: UserType, language: string }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speak = async (text: string, index: number) => {
    // Stop any ongoing speech
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();

    if (speakingIdx === index) {
      setSpeakingIdx(null);
      return;
    }

    setSpeakingIdx(index);
    try {
      // Try Gemini TTS first
      const audioData = await generateSpeech(text);
      if (audioData) {
        const audio = new Audio(`data:audio/wav;base64,${audioData}`);
        audioRef.current = audio;
        audio.playbackRate = 1.2; // Increase playback speed
        audio.onended = () => {
          setSpeakingIdx(null);
          audioRef.current = null;
        };
        audio.play();
      } else {
        throw new Error("No audio data");
      }
    } catch (error) {
      console.warn("Gemini TTS failed, falling back to browser TTS", error);
      // Fallback to browser SpeechSynthesis
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = getLangCode(language);
      utterance.rate = 1.2; // Increase speech rate
      utterance.onend = () => setSpeakingIdx(null);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;

    const newMessages = [...messages, { role: 'user' as const, text: msg }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await chatWithAssistant(msg, messages, language);
      const assistantMsg = { role: 'model' as const, text: response };
      setMessages([...newMessages, assistantMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = getLangCode(language);
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSend(transcript);
    };
    recognition.start();
  };

  return (
    <GlassCard className="flex flex-col h-[600px] border-blue-500/20" hover={false}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <MessageSquare size={20} />
          </div>
          <div>
            <h2 className="font-bold">AI Health Assistant</h2>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Powered by ClinIQ AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="text-[10px] uppercase tracking-widest text-white/40">{loading ? 'Thinking...' : 'Online'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-blue-500/5 flex items-center justify-center mb-4 border border-blue-500/10">
              <Mic size={32} className="text-blue-400/50" />
            </div>
            <p className="text-white/40 text-sm">
              Ask me anything about your medicines, dosage, or health doubts in {language}.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`max-w-[80%] p-4 rounded-2xl backdrop-blur-md ${
              msg.role === 'user' 
                ? 'bg-blue-600/20 border border-blue-500/30 text-white shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                : 'bg-white/5 border border-white/10 text-white/90 shadow-[0_0_15px_rgba(255,255,255,0.02)]'
            }`}>
              {msg.text}
            </div>
              <button 
                onClick={() => speak(msg.text, i)}
                className={`mt-2 p-2 rounded-lg border transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest ${
                  speakingIdx === i 
                    ? 'bg-red-500/20 border-red-500/50 text-red-400' 
                    : 'bg-white/5 border border-white/10 text-white/40 hover:text-emerald-400 hover:border-emerald-500/30'
                }`}
              >
                {speakingIdx === i ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />} 
                {speakingIdx === i ? 'Stop' : 'Listen'}
              </button>
          </motion.div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="flex gap-3">
        <button 
          onClick={toggleListening}
          className={`p-4 rounded-xl border transition-all ${
            isListening 
              ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse' 
              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
          }`}
        >
          <Mic size={24} />
        </button>
        <div className="flex-1 relative">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Type your question in ${language}...`}
            className="w-full h-full bg-white/5 border border-white/10 rounded-xl px-4 pr-12 outline-none focus:border-blue-500/50 transition-all"
          />
          <button 
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-400 hover:text-blue-300 disabled:opacity-30"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function PatientProfile({ patient, user, onBack, onScan, onVitals, initialTab = 'timeline' }: { patient: any, user: UserType, onBack: () => void, onScan: () => void, onVitals: () => void, initialTab?: 'timeline' | 'vitals' | 'alerts' | 'insights' | 'private' }) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'vitals' | 'alerts' | 'insights' | 'private'>(initialTab);
  const [predicting, setPredicting] = useState(false);
  const [risks, setRisks] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [showEmergency, setShowEmergency] = useState(false);

  const runRiskPrediction = async () => {
    setPredicting(true);
    try {
      const [riskData, patternData] = await Promise.all([
        predictHealthRisks(patient.vitals, patient.prescriptions),
        detectDiseasePatterns(patient.prescriptions)
      ]);
      setRisks(riskData);
      setPatterns(patternData);
    } finally {
      setPredicting(false);
    }
  };

  useEffect(() => {
    runRiskPrediction();
  }, [patient.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <AnimatePresence>
        {showEmergency && (
          <EmergencySnapshot patient={patient} onClose={() => setShowEmergency(false)} />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold">{patient.name}</h1>
            <p className="text-white/50">Patient ID: {patient.id} • {patient.age}y</p>
          </div>
        </div>
        <div className="flex gap-3">
          <NeonButton onClick={() => setShowEmergency(true)} variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
            <ShieldAlert size={18} className="mr-2" />
            Emergency Snapshot
          </NeonButton>
          <NeonButton onClick={onVitals} variant="outline">Record Vitals</NeonButton>
          <NeonButton onClick={onScan} variant="outline" className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10">
            <FlaskConical size={18} className="mr-2" />
            Scan Lab Report
          </NeonButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Info - Instant Patient Summary */}
        <div className="space-y-6">
          <GlassCard hover={false} className="border-emerald-500/20">
            <h3 className="text-xs uppercase tracking-widest text-emerald-400 mb-4 font-bold">Instant Summary</h3>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-tighter text-white/30">Past Illness</p>
                <p className="text-sm text-white/80">{patient.past_illness || 'None'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-tighter text-white/30">Current Medicines</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {patient.prescriptions?.[0] ? (
                    JSON.parse(patient.prescriptions[0].medicines).map((m: any, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {m.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-white/40">None</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-tighter text-white/30">Allergies</p>
                <p className={`text-sm font-medium ${patient.allergies ? 'text-red-400' : 'text-white/60'}`}>
                  {patient.allergies || 'None Reported'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-tighter text-white/30">Chronic Risk</p>
                <p className="text-sm text-white/60">{patient.chronic_conditions || 'None'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-tighter text-white/30">Last Visit Date</p>
                <p className="text-sm text-white/60 italic">"{patient.prescriptions?.[0]?.date || 'N/A'}"</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard hover={false} className="bg-emerald-500/5 border-emerald-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs uppercase tracking-widest text-emerald-400">AI Health Insights</h3>
              <button 
                onClick={runRiskPrediction} 
                disabled={predicting}
                className="text-[10px] text-emerald-400 hover:underline disabled:opacity-50"
              >
                {predicting ? 'Analyzing...' : 'Refresh'}
              </button>
            </div>
            <div className="space-y-3">
              {risks.length > 0 ? (
                risks.map((r, i) => (
                  <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/5">
                    <p className="text-xs font-medium text-emerald-400">{r.risk} ({r.confidence})</p>
                    <p className="text-[10px] text-white/50 mt-1">{r.reasoning}</p>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-xs font-medium text-emerald-400">Risk: Low</p>
                  <p className="text-[10px] text-white/50 mt-1">No chronic risk patterns detected in recent visits.</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Main Content Tabs */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex gap-4 border-b border-white/5">
            {(['timeline', 'vitals', 'alerts', 'insights', 'private'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 px-2 text-sm font-medium transition-all relative ${activeTab === tab ? 'text-emerald-400' : 'text-white/40 hover:text-white'}`}
              >
                {tab === 'private' ? 'Private Vault' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'timeline' && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {patient.prescriptions?.length === 0 ? (
                  <div className="text-center py-12 text-white/30">No prescription history found.</div>
                ) : (
                  patient.prescriptions.map((rx: any, idx: number) => (
                    <div key={rx.id} className="relative pl-8 border-l border-white/10 pb-8 last:pb-0">
                      <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-white/40 font-mono">{rx.date}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-white/5 border border-white/5 text-white/60">Dr. {rx.doctor_name}</span>
                      </div>
                      <GlassCard hover={false} className="p-4">
                        <p className="text-sm text-white/60 mb-4 italic">"{rx.symptoms}"</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {JSON.parse(rx.medicines).map((med: any, mIdx: number) => (
                            <div key={mIdx} className="p-3 rounded-lg bg-white/5 border border-white/5">
                              <p className="text-sm font-medium">{med.name}</p>
                              <p className="text-xs text-white/40">{med.dosage} • {med.frequency}</p>
                            </div>
                          ))}
                        </div>
                      </GlassCard>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'vitals' && (
              <motion.div
                key="vitals"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {patient.vitals?.length === 0 ? (
                  <div className="text-center py-12 text-white/30">No vitals recorded yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs uppercase tracking-widest text-white/30 border-b border-white/5">
                          <th className="py-4 px-4">Date</th>
                          <th className="py-4 px-4">BP</th>
                          <th className="py-4 px-4">HR</th>
                          <th className="py-4 px-4">Temp</th>
                          <th className="py-4 px-4">Weight</th>
                          <th className="py-4 px-4">By</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {patient.vitals.map((v: any) => (
                          <tr key={v.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-4 px-4 text-white/60">{new Date(v.recorded_at).toLocaleDateString()}</td>
                            <td className="py-4 px-4 font-medium">{v.bp}</td>
                            <td className="py-4 px-4">{v.heart_rate} bpm</td>
                            <td className="py-4 px-4">{v.temperature}°C</td>
                            <td className="py-4 px-4">{v.weight} kg</td>
                            <td className="py-4 px-4 text-xs text-white/40">{v.recorded_by}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'alerts' && (
              <motion.div
                key="alerts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {patient.alerts?.length === 0 ? (
                  <div className="text-center py-12 text-white/30">No active safety alerts.</div>
                ) : (
                  patient.alerts.map((alert: any) => (
                    <GlassCard key={alert.id} className="border-red-500/20 bg-red-500/5">
                      <div className="flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1">{alert.type}</p>
                          <p className="text-sm text-white/80">{alert.message}</p>
                          <p className="text-[10px] text-white/30 mt-2">{new Date(alert.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </GlassCard>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'insights' && (
              <motion.div
                key="insights"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Dna className="text-emerald-400" size={20} />
                  AI Disease Pattern Detection
                </h3>
                {patterns.length === 0 ? (
                  <div className="text-center py-12 text-white/30">No significant visit patterns detected yet.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {patterns.map((p, i) => (
                      <GlassCard key={i} className="border-emerald-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <p className="text-sm font-bold text-emerald-400 uppercase">{p.pattern}</p>
                        </div>
                        <p className="text-sm font-medium mb-1">Suggested Risk: {p.suggestedRisk}</p>
                        <p className="text-xs text-white/60 mb-3">{p.reasoning}</p>
                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Next Steps</p>
                          <p className="text-[10px] text-white/80">{p.nextSteps}</p>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'private' && (
              <motion.div
                key="private"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <PrivateVault 
                  user={user} 
                  unlocked={true} 
                  setUnlocked={() => {}} 
                  onBack={() => setActiveTab('timeline')} 
                  onSelectPatient={() => {}} 
                  filterPatientId={patient.id}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function EmergencySnapshot({ patient, onClose }: { patient: any, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-lg"
      >
        <GlassCard hover={false} className="border-red-500/50 bg-zinc-950 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-red-500 text-white animate-pulse">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Emergency Snapshot</h2>
                <p className="text-xs text-red-400 font-bold uppercase tracking-widest">Critical Treatment Data</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Blood Group</p>
              <p className="text-2xl font-bold text-red-400">{patient.blood_group || 'Unknown'}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Age</p>
              <p className="text-xl font-bold">{patient.age}y</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
              <p className="text-[10px] uppercase tracking-widest text-red-400 font-bold mb-2">Allergies</p>
              <p className="text-sm font-medium">{patient.allergies || 'NONE REPORTED'}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Chronic Illness</p>
              <p className="text-sm font-medium">{patient.chronic_conditions || 'None'}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Current Medicines</p>
              <div className="flex flex-wrap gap-2">
                {patient.prescriptions?.[0] ? (
                  JSON.parse(patient.prescriptions[0].medicines).map((m: any, i: number) => (
                    <span key={i} className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {m.name} ({m.dosage})
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-white/40">No active medications</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <NeonButton onClick={onClose} className="w-full bg-red-500 hover:bg-red-600 border-red-400">
              Close Snapshot
            </NeonButton>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

function PrescriptionScanner({ user, patientId, onComplete, onCancel, initialMode = 'upload', offlineMode = false }: { user: UserType, patientId?: number, onComplete: (data: any) => void, onCancel: () => void, initialMode?: 'upload' | 'voice', offlineMode?: boolean }) {
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>(initialMode === 'voice' ? 'upload' : 'upload');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [extractedData, setExtractedData] = useState<any>(null);
  const [safetyAlerts, setSafetyAlerts] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        processImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function processImage(base64: string) {
    setStep('processing');
    setLoadingProgress(10);
    
    if (offlineMode) {
      setLoadingProgress(100);
      setExtractedData({
        medicines: [],
        symptoms: 'Captured Offline (Pending Sync)',
        notes: 'This prescription was captured while offline. It will be processed when you go back online.'
      });
      setStep('review');
      return;
    }

    try {
      setLoadingProgress(40);
      const data = await extractPrescriptionData(base64);
      setLoadingProgress(70);
      
      // Ensure medicines is always an array
      if (data && !data.medicines) {
        data.medicines = [];
      }
      
      setExtractedData(data);
      
      if (patientId && data.medicines && data.medicines.length > 0) {
        try {
          const res = await fetch(`/api/patients/${patientId}`);
          const patient = await res.json();
          const alerts = await analyzeDrugSafety(data.medicines, patient);
          setSafetyAlerts(alerts);
        } catch (err) {
          console.warn("Safety analysis failed:", err);
        }
      }
      
      setLoadingProgress(100);
      setStep('review');
    } catch (error: any) {
      console.error("Error processing prescription:", error);
      alert(error.message || 'Error processing prescription. Please try again with a clearer image.');
      setStep('upload');
    }
  }

  async function processAudio(base64: string) {
    setStep('processing');
    try {
      const { speechToRecord } = await import('./services/geminiService');
      const data = await speechToRecord(base64.split(',')[1] || base64);
      setExtractedData(data);
      
      if (patientId) {
        const res = await fetch(`/api/patients/${patientId}`);
        const patient = await res.json();
        const risks = await analyzeClinicalRisk(data, patient.prescriptions);
        setSafetyAlerts(risks);
      }
      
      setStep('review');
    } catch (error) {
      alert('Error processing audio. Please try again.');
      setStep('upload');
    }
  }

  async function processTranscript(transcript: string) {
    setStep('processing');
    try {
      const data = await voicePrescriptionToDigital(transcript);
      setExtractedData(data);
      
      if (patientId) {
        const res = await fetch(`/api/patients/${patientId}`);
        const patient = await res.json();
        const risks = await analyzeClinicalRisk(data, patient.prescriptions);
        setSafetyAlerts(risks);
      }
      
      setStep('review');
    } catch (error) {
      alert('Error processing voice command.');
      setStep('upload');
    }
  }

  function handleVoiceMode() {
    setIsListening(true);
    setLiveTranscript('');
    
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      setLiveTranscript(prev => {
        // This is a bit tricky with continuous. 
        // Let's just rebuild the whole thing from event.results for simplicity
        return Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join(' ');
      });
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error !== 'no-speech') {
        setIsListening(false);
        alert(`Voice recognition error: ${event.error}. Please try again.`);
      }
    };

    recognition.onend = () => {
      // Don't automatically close if we are still "listening" (waiting for user to click Finish)
      // But if the browser stops it, we should know.
      console.log('Recognition ended');
    };

    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  }

  function finishVoiceMode() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    if (liveTranscript.trim()) {
      processTranscript(liveTranscript);
    } else {
      setStep('upload');
    }
  }

  useEffect(() => {
    if (initialMode === 'voice') {
      const timer = setTimeout(() => {
        handleVoiceMode();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialMode]);

  const handleSave = async () => {
    setStep('processing');
    
    if (offlineMode) {
      const offlineScans = JSON.parse(localStorage.getItem('offlineScans') || '[]');
      offlineScans.push({
        patient_id: patientId,
        image_data: image,
        timestamp: new Date().toISOString(),
        staff_id: user.username,
        staff_name: user.name
      });
      localStorage.setItem('offlineScans', JSON.stringify(offlineScans));
      alert('Prescription captured and saved locally. It will be processed once you are back online.');
      onComplete({});
      return;
    }

    try {
      // 1. Create patient if doesn't exist
      let pid = patientId;
      if (!pid) {
        const pRes = await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: (extractedData.patientName && !['Unknown', 'N/A', 'Unknown Patient'].includes(extractedData.patientName)) ? extractedData.patientName : 'Unknown Patient',
            age: extractedData.age || 0,
            phone: extractedData.phone || `SCAN-${Date.now()}`,
            allergies: '',
            chronic_conditions: ''
          })
        });
        const pData = await pRes.json();
        pid = pData.id;
      }

      // 2. Save prescription
      const rxRes = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: pid,
          doctor_name: extractedData.doctorName || 'Dr. Sharma',
          symptoms: extractedData.symptoms || 'Voice Recorded',
          medicines: extractedData.medicines,
          date: extractedData.date || new Date().toISOString().split('T')[0],
          image_data: image
        })
      });

      // 4. Generate Patient Explanation
      const explanation = await explainPrescriptionSimple(extractedData.medicines, 'English');
      
      // 3. Save safety alerts & explanation
      for (const alert of safetyAlerts) {
        await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: pid,
            type: alert.type,
            message: `${alert.message}. Recommendation: ${alert.recommendation}`
          })
        });
      }

      // Save explanation as a special alert or info
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: pid,
          type: 'Patient Explanation',
          message: explanation
        })
      });

      // 5. Save to Private Data if Nurse or Doctor
      if (user.role === 'nurse' || user.role === 'doctor') {
        await fetch('/api/private-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: user.username,
            staff_name: user.name,
            content: `MANUAL PATIENT RECORD\n----------------------\nPatient: ${extractedData.patientName || 'Unknown'}\nPatient ID: ${pid || 'N/A'}\nPhone: ${extractedData.phone || 'N/A'}\nAge: ${extractedData.age || 'N/A'}\nBP: ${extractedData.bp || 'N/A'}\nBlood Group: ${extractedData.bloodGroup || 'N/A'}\nDoctor: ${extractedData.doctorName || 'Dr. Sharma'}\nMedicines: ${JSON.stringify(extractedData.medicines, null, 2)}\nDate: ${extractedData.date || new Date().toISOString()}`
          })
        });
      }

      onComplete(extractedData);
    } catch (error) {
      alert('Error saving record.');
      setStep('review');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {step === 'upload' && !isListening && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-lg">
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-2xl font-bold">AI Prescription Scanner</h1>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/10 rounded-3xl p-12 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all cursor-pointer group"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Camera size={32} className="text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Scan Image</h3>
                <p className="text-xs text-white/40">Handwritten prescriptions</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              
              <div 
                onClick={handleVoiceMode}
                className="border-2 border-dashed border-white/10 rounded-3xl p-12 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer group"
              >
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Mic size={32} className="text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Voice Prescription</h3>
                <p className="text-xs text-white/40">Speak the prescription details</p>
              </div>
            </div>
          </motion.div>
        )}

        {isListening && (
          <motion.div
            key="listening"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 space-y-6"
          >
            <div className="relative w-24 h-24 mx-auto">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 bg-blue-500/20 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Mic className="text-blue-400 animate-pulse" size={48} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-blue-400">Listening...</h2>
            <div className="min-h-[120px] max-w-md mx-auto p-6 rounded-3xl bg-white/5 border border-white/10 italic text-white/70 text-lg leading-relaxed">
              {liveTranscript || "Waiting for speech..."}
            </div>
            <p className="text-sm text-white/50">Speak as long as you need. Click "Finish" when done.</p>
            <div className="flex justify-center gap-4">
              <NeonButton variant="outline" onClick={() => {
                if (recognitionRef.current) recognitionRef.current.stop();
                setIsListening(false);
              }}>Cancel</NeonButton>
              <NeonButton onClick={finishVoiceMode}>Finish Speaking</NeonButton>
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 space-y-6"
          >
            <div className="relative w-24 h-24 mx-auto">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className="text-emerald-400 animate-pulse" size={32} />
              </div>
            </div>
            <h2 className="text-2xl font-bold neon-text">AI is Analyzing...</h2>
            <div className="max-w-xs mx-auto space-y-4">
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <motion.div 
                  className="bg-emerald-500 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${loadingProgress}%` }}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-white/50">{loadingProgress < 40 ? 'Extracting handwriting patterns...' : loadingProgress < 80 ? 'Cross-referencing drug database...' : 'Checking safety protocols...'}</p>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'review' && extractedData && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Review Digital Record</h2>
              <div className="flex gap-2">
                <NeonButton variant="outline" onClick={() => setStep('upload')}>Retake</NeonButton>
                <NeonButton onClick={handleSave}>Confirm & Save</NeonButton>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlassCard hover={false}>
                <h3 className="text-xs uppercase tracking-widest text-white/40 mb-4">Patient & Vitals</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-white/30 uppercase">Name</label>
                      <p className="font-medium">{extractedData.patientName || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 uppercase">Phone</label>
                      <p className="font-medium">{extractedData.phone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="text-[10px] text-white/30 uppercase">Age</label>
                      <p className="font-medium">{extractedData.age || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 uppercase">Blood Group</label>
                      <p className="font-medium">{extractedData.bloodGroup || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 uppercase">BP</label>
                      <p className="font-medium text-emerald-400">{extractedData.bp || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </GlassCard>

              <GlassCard hover={false} className={safetyAlerts.length > 0 ? 'border-red-500/30' : ''}>
                <h3 className="text-xs uppercase tracking-widest text-white/40 mb-4">AI Drug Safety Check</h3>
                {safetyAlerts.length === 0 ? (
                  <div className="flex items-center gap-3 text-emerald-400">
                    <CheckCircle2 size={24} />
                    <p className="text-sm font-medium">No safety risks detected.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {safetyAlerts.map((alert, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-xs font-bold text-red-400 uppercase">{alert.type}</p>
                        <p className="text-xs text-white/80 mt-1">{alert.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>

            <GlassCard hover={false}>
              <h3 className="text-xs uppercase tracking-widest text-white/40 mb-4">Medicines Extracted</h3>
              <div className="space-y-3">
                {extractedData.medicines?.map((med: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                    <div>
                      <p className="font-medium text-emerald-400">{med.name}</p>
                      <p className="text-xs text-white/60">{med.dosage} • {med.frequency}</p>
                      {med.instructions && <p className="text-[10px] text-amber-400/70 mt-1 italic">Note: {med.instructions}</p>}
                    </div>
                    <div className="text-xs text-white/30">{med.duration}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VitalsForm({ patient, onComplete, onCancel, user }: { patient?: any, onComplete: () => void, onCancel: () => void, user: any }) {
  const [formData, setFormData] = useState({
    patient_id: patient?.id || '',
    patient_name: patient?.name || '',
    bp: '',
    blood_group: '',
    weight: '',
    phone: '',
    symptoms: '',
    notes: '',
    recorded_by: user?.name || 'Nurse Meena'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const isOffline = localStorage.getItem('offlineMode') === 'true';

    try {
      if (isOffline) {
        // Store locally for sync
        const offlineData = JSON.parse(localStorage.getItem('offlineIntake') || '[]');
        offlineData.push({
          ...formData,
          timestamp: new Date().toISOString(),
          id: Date.now()
        });
        localStorage.setItem('offlineIntake', JSON.stringify(offlineData));
        
        alert('Data saved locally (Offline Mode). It will sync when you are back online.');
        onComplete();
        return;
      }

      // Online mode: Save vitals
      const vitalsRes = await fetch('/api/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: formData.patient_id,
          bp: formData.bp,
          weight: parseFloat(formData.weight) || 0,
          symptoms: formData.symptoms,
          notes: `${formData.notes} | Blood Group: ${formData.blood_group} | Phone: ${formData.phone}`,
          recorded_by: formData.recorded_by
        })
      });

      if (vitalsRes.ok) {
        // Also store in private data vault for security
        const content = `PATIENT INTAKE RECORD
----------------------------
Patient: ${formData.patient_name}
ID: ${formData.patient_id}
BP: ${formData.bp}
Weight: ${formData.weight} kg
Blood Group: ${formData.blood_group}
Phone: ${formData.phone}
Symptoms: ${formData.symptoms}
Notes: ${formData.notes}
Recorded By: ${formData.recorded_by}`;

        await fetch('/api/private-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: user?.id || 'STAFF001',
            staff_name: user?.name || 'Nurse Meena',
            content: content
          })
        });
      }

      onComplete();
    } catch (err) {
      console.error('Error saving intake:', err);
      alert('Error saving data. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <GlassCard hover={false}>
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">Patient Intake Mode</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Patient Name</label>
            <input
              type="text"
              required
              value={formData.patient_name}
              onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all"
              placeholder="Enter Patient Name"
            />
          </div>

          {!patient && (
            <div>
              <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Patient ID</label>
              <input
                type="number"
                required
                value={formData.patient_id}
                onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all"
                placeholder="Enter Patient ID"
              />
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Blood Pressure</label>
              <input
                type="text"
                required
                value={formData.bp}
                onChange={(e) => setFormData({ ...formData, bp: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all"
                placeholder="120/80"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Blood Group</label>
              <select
                required
                value={formData.blood_group}
                onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all"
              >
                <option value="" disabled className="bg-slate-900">Select Group</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                  <option key={bg} value={bg} className="bg-slate-900">{bg}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                required
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all"
                placeholder="65.0"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Phone No</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all"
                placeholder="9876543210"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Symptoms</label>
            <textarea
              required
              value={formData.symptoms}
              onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all h-20"
              placeholder="e.g. Fever, Cough, Headache"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Initial Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all h-20"
              placeholder="Any additional observations..."
            />
          </div>

          <div className="pt-4 flex gap-3">
            <NeonButton variant="outline" className="flex-1" onClick={onCancel}>Cancel</NeonButton>
            <NeonButton className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Save Intake Data'}
            </NeonButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

function PatientIntakeForm({ user, onComplete, onCancel }: { user: UserType, onComplete: (id: number) => void, onCancel: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    phone: '',
    blood_group: 'O+',
    allergies: '',
    chronic_conditions: '',
    past_illness: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (localStorage.getItem('offlineMode') === 'true') {
        const offlinePatients = JSON.parse(localStorage.getItem('offlinePatients') || '[]');
        const tempId = Date.now();
        const newPatient = { ...formData, id: tempId };
        offlinePatients.push(newPatient);
        localStorage.setItem('offlinePatients', JSON.stringify(offlinePatients));
        
        onComplete(tempId);
        return;
      }

      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        // Also store in private data vault for security
        const content = `NEW PATIENT REGISTRATION
----------------------------
Patient: ${formData.name}
Age: ${formData.age}
Phone: ${formData.phone}
Blood Group: ${formData.blood_group}
Allergies: ${formData.allergies}
Chronic Conditions: ${formData.chronic_conditions}
Past Illness: ${formData.past_illness}`;

        await fetch('/api/private-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: user?.id || 'STAFF001',
            staff_name: user?.name || 'Nurse Meena',
            content: content
          })
        });

        onComplete(data.id);
      } else {
        alert(data.error || 'Failed to create patient');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <GlassCard hover={false}>
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">New Patient Intake</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Full Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all"
                placeholder="Ramesh Kumar"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Phone Number</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all"
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Age</label>
              <input
                type="number"
                required
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all"
                placeholder="45"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Blood Group</label>
              <select
                value={formData.blood_group}
                onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all appearance-none"
              >
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                  <option key={bg} value={bg} className="bg-zinc-900">{bg}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Allergies</label>
              <textarea
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all h-20"
                placeholder="e.g. Penicillin, Peanuts"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 ml-1">Chronic Conditions</label>
              <textarea
                value={formData.chronic_conditions}
                onChange={(e) => setFormData({ ...formData, chronic_conditions: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all h-20"
                placeholder="e.g. Diabetes, Hypertension"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <NeonButton variant="outline" className="flex-1" onClick={onCancel}>Cancel</NeonButton>
            <NeonButton className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Register Patient'}
            </NeonButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

function TodayAppointments({ user, onBack }: { user: UserType, onBack: () => void }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const url = user.role === 'doctor' ? `/api/appointments?doctor_name=${encodeURIComponent(user.name)}` : '/api/appointments';
        const res = await fetch(url);
        const data = await res.json();
        setAppointments(data);
      } catch (error) {
        console.error('Error fetching appointments:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, [user]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto"
    >
      <GlassCard className="p-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">Today's Appointments</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            <Calendar size={48} className="mx-auto mb-4 opacity-20" />
            <p>No appointments scheduled for today.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((appt, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold">
                    {appt.time}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{appt.patient_name}</p>
                    <p className="text-xs text-white/40 uppercase tracking-widest">{appt.reason}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">Doctor</p>
                  <p className="text-xs font-medium text-emerald-400">{appt.doctor_name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

function AppointmentForm({ onComplete, onCancel }: { onComplete: () => void, onCancel: () => void }) {
  const [formData, setFormData] = useState({
    patientName: '',
    time: '',
    reason: '',
    doctor: ''
  });
  const [doctors, setDoctors] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await fetch('/api/doctors');
        const data = await res.json();
        setDoctors(data);
      } catch (error) {
        console.error('Error fetching doctors:', error);
      }
    };
    fetchDoctors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: formData.patientName,
          doctorName: formData.doctor,
          time: formData.time,
          reason: formData.reason
        })
      });
      
      if (!res.ok) throw new Error('Failed to save appointment');
      
      onComplete();
    } catch (error) {
      alert('Error saving appointment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-md mx-auto"
    >
      <GlassCard className="p-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">New Appointment</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Patient Name</label>
            <input 
              required
              type="text"
              value={formData.patientName}
              onChange={e => setFormData({ ...formData, patientName: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-all"
              placeholder="Enter patient name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Time</label>
              <input 
                required
                type="time"
                value={formData.time}
                onChange={e => setFormData({ ...formData, time: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Doctor</label>
              <select 
                required
                value={formData.doctor}
                onChange={e => setFormData({ ...formData, doctor: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-all"
              >
                <option value="" disabled className="bg-slate-900">Select Doctor</option>
                {doctors.map((doc, idx) => (
                  <option key={idx} value={doc.name} className="bg-slate-900">{doc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Reason for Visit</label>
            <textarea 
              required
              value={formData.reason}
              onChange={e => setFormData({ ...formData, reason: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-all h-24 resize-none"
              placeholder="Brief description..."
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Calendar size={20} />
                Confirm Appointment
              </>
            )}
          </button>
        </form>
      </GlassCard>
    </motion.div>
  );
}

function LabReportScanner({ user, onComplete, onCancel, initialPatient }: { user: UserType, onComplete: () => void, onCancel: () => void, initialPatient?: any }) {
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        processDocument(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processDocument = async (base64: string) => {
    setStep('processing');
    setLoadingProgress(20);
    try {
      setLoadingProgress(40);
      const data = await extractMedicalDocumentData(base64);
      
      // Ensure patientInfo exists
      if (data && !data.patientInfo) {
        data.patientInfo = { name: 'Unknown Patient' };
      }
      
      setLoadingProgress(100);
      setExtractedData(data);
      setStep('review');
    } catch (error) {
      console.error("Error processing lab report:", error);
      alert('Error processing lab report. Please try again with a clearer image.');
      setStep('upload');
    }
  };

  const handleSave = async () => {
    setStep('processing');
    try {
      const pName = initialPatient?.name || (extractedData.patientInfo?.name && !['Unknown', 'N/A', 'Unknown Patient'].includes(extractedData.patientInfo.name) ? extractedData.patientInfo.name : 'Unknown');
      const content = `LAB REPORT SCAN RECORD\n----------------------------\nType: ${extractedData.documentType || 'Lab Report'}\nPatient: ${pName}\nPhone: ${extractedData.patientInfo?.phone || 'N/A'}\nBP: ${extractedData.patientInfo?.bp || 'N/A'}\nSummary: ${extractedData.summary}\nMetrics: ${JSON.stringify(extractedData.extractedData, null, 2)}`;

      await fetch('/api/pending-lab-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: initialPatient?.id || extractedData.patientInfo?.id || 1,
          patient_name: pName === 'Unknown' ? (initialPatient?.name || 'Unknown Patient') : pName,
          staff_id: user.username,
          staff_name: user.name,
          content: content,
          image_data: image
        })
      });

      onComplete();
    } catch (error) {
      alert('Error saving lab report.');
      setStep('review');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-lg">
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-2xl font-bold">Scan Lab Report</h1>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-3xl p-12 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all cursor-pointer group"
            >
              <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <FlaskConical size={32} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Upload Blood Test or X-Ray</h3>
              <p className="text-xs text-white/40">AI will extract key metrics and findings</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-20 space-y-6"
          >
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Brain size={32} className="text-purple-400 animate-pulse" />
              </div>
            </div>
            <h2 className="text-xl font-bold">AI Analyzing Lab Report...</h2>
            <div className="max-w-xs mx-auto space-y-4">
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <motion.div 
                  className="bg-purple-500 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${loadingProgress}%` }}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-white/50">{loadingProgress < 40 ? 'Scanning document structure...' : loadingProgress < 80 ? 'Extracting clinical values...' : 'Generating summary...'}</p>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <CheckCircle2 className="text-emerald-400" /> Review Extraction
              </h2>
              <div className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] uppercase font-bold tracking-widest">
                Lab Report
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlassCard className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Report Summary</h3>
                <p className="text-sm leading-relaxed">{extractedData?.summary}</p>
              </GlassCard>

              <GlassCard className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Extracted Metrics</h3>
                <div className="space-y-2">
                  {Object.entries(extractedData?.extractedData || {}).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex justify-between items-center p-2 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-xs text-white/60 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="text-xs font-bold">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>

            <div className="flex gap-4 pt-6">
              <button 
                onClick={() => setStep('upload')}
                className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all"
              >
                Rescan
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 py-4 rounded-2xl bg-purple-500 text-white font-bold hover:bg-purple-600 transition-all shadow-lg shadow-purple-500/20"
              >
                Store in Pending Labs
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MedicalDocumentScanner({ user, onComplete, onCancel }: { user: UserType, onComplete: () => void, onCancel: () => void }) {
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [image, setImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        processDocument(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processDocument = async (base64: string) => {
    setStep('processing');
    try {
      const data = await extractMedicalDocumentData(base64);
      
      // Ensure patientInfo exists
      if (data && !data.patientInfo) {
        data.patientInfo = { name: 'Unknown Patient' };
      }
      
      setExtractedData(data);
      setStep('review');
    } catch (error) {
      console.error("Error processing document:", error);
      alert('Error processing document. Please try again with a clearer image.');
      setStep('upload');
    }
  };

  const handleSave = async () => {
    setStep('processing');
    try {
      // 1. Create or Update Patient
      const pRes = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: (extractedData.patientInfo?.name && !['Unknown', 'N/A', 'Unknown Patient'].includes(extractedData.patientInfo.name)) ? extractedData.patientInfo.name : 'Unknown Patient',
          age: extractedData.patientInfo?.age || 0,
          phone: extractedData.patientInfo?.phone || `SCAN-${Date.now()}`,
          allergies: '',
          chronic_conditions: ''
        })
      });
      const pData = await pRes.json();
      const pid = pData.id;

      // 2. Save document data as an alert/note for now
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: pid,
          type: extractedData.documentType || 'Document Scan',
          message: `AI Extracted Summary: ${extractedData.summary}. Details: ${JSON.stringify(extractedData.extractedData)}`
        })
      });

      // 3. Save to Private Data if Nurse
      if (user.role === 'nurse') {
        await fetch('/api/private-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: user.username,
            staff_name: user.name,
            content: `MEDICAL DOCUMENT SCAN RECORD\n----------------------------\nType: ${extractedData.documentType}\nPatient: ${extractedData.patientInfo?.name || 'Unknown'}\nPhone: ${extractedData.patientInfo?.phone || 'N/A'}\nAge: ${extractedData.patientInfo?.age || 'N/A'}\nBP: ${extractedData.patientInfo?.bp || 'N/A'}\nBlood Group: ${extractedData.patientInfo?.bloodGroup || 'N/A'}\nSummary: ${extractedData.summary}\nDetails: ${JSON.stringify(extractedData.extractedData, null, 2)}`
          })
        });
      }

      onComplete();
    } catch (error) {
      alert('Error saving record.');
      setStep('review');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-lg">
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-2xl font-bold">New Patient Scan & Store</h1>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-3xl p-12 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all cursor-pointer group"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Camera size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Scan Document</h3>
              <p className="text-xs text-white/40">Prescriptions, Reports, or ID Cards</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 space-y-4"
          >
            <Loader2 size={48} className="animate-spin text-emerald-400 mx-auto" />
            <h2 className="text-xl font-semibold">AI Extracting Data...</h2>
            <p className="text-white/40">Analyzing document structure and content</p>
          </motion.div>
        )}

        {step === 'review' && extractedData && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Review Extracted Data</h2>
              <div className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold border border-emerald-500/30">
                {extractedData.documentType}
              </div>
            </div>

            <GlassCard hover={false}>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Patient Name</label>
                    <input 
                      type="text"
                      value={extractedData.patientInfo?.name || ''}
                      onChange={(e) => setExtractedData({
                        ...extractedData,
                        patientInfo: { ...extractedData.patientInfo, name: e.target.value }
                      })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Age</label>
                    <input 
                      type="number"
                      value={extractedData.patientInfo?.age || ''}
                      onChange={(e) => setExtractedData({
                        ...extractedData,
                        patientInfo: { ...extractedData.patientInfo, age: parseInt(e.target.value) }
                      })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Blood Group</label>
                    <input 
                      type="text"
                      value={extractedData.patientInfo?.bloodGroup || ''}
                      onChange={(e) => setExtractedData({
                        ...extractedData,
                        patientInfo: { ...extractedData.patientInfo, bloodGroup: e.target.value }
                      })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Summary</label>
                  <p className="text-sm text-white/80 bg-white/5 p-3 rounded-xl border border-white/5">
                    {extractedData.summary}
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Extracted Details</label>
                  <pre className="text-[10px] text-emerald-400/80 bg-black/20 p-3 rounded-xl border border-white/5 overflow-x-auto">
                    {JSON.stringify(extractedData.extractedData, null, 2)}
                  </pre>
                </div>
              </div>
            </GlassCard>

            <div className="flex gap-3">
              <NeonButton variant="outline" className="flex-1" onClick={() => setStep('upload')}>Rescan</NeonButton>
              <NeonButton className="flex-1" onClick={handleSave}>Confirm & Store</NeonButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PrivateVault({ user, unlocked, setUnlocked, onBack, onSelectPatient, filterPatientId }: { 
  user: UserType, 
  unlocked: boolean, 
  setUnlocked: (u: boolean) => void, 
  onBack: () => void,
  onSelectPatient: (id: number, tab?: 'timeline' | 'vitals' | 'alerts' | 'insights' | 'private') => void,
  filterPatientId?: number
}) {
  const [password, setPassword] = useState('');
  const [data, setData] = useState<PrivateData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<PrivateData | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualData, setManualData] = useState({ patientName: '', patientId: filterPatientId?.toString() || '', age: '', phone: '', bp: '', bloodGroup: '', details: '' });
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    const newSet = new Set(expandedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedItems(newSet);
  };

  const fetchPrivateData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/private-data?staff_id=${user.username}&role=${user.role}`);
      if (!res.ok) throw new Error('Failed to fetch private data');
      const items = await res.json();
      
      // Filter by patient ID if provided
      if (filterPatientId) {
        const filtered = items.filter((item: PrivateData) => {
          const lines = item.content.split('\n');
          return lines.some(line => line.includes(`Patient ID: ${filterPatientId}`));
        });
        setData(filtered);
      } else {
        setData(items);
      }
    } catch (error) {
      console.error('Error fetching private data:', error);
      alert('Error loading private data vault.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (unlocked) {
      fetchPrivateData();
    }
  }, [unlocked, filterPatientId]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'inba@123') {
      setUnlocked(true);
    } else {
      alert('Incorrect Password');
    }
  };

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/private-data/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchPrivateData();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    await fetch(`/api/private-data/${editingItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent }),
    });
    setEditingItem(null);
    fetchPrivateData();
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = `MANUAL PATIENT RECORD\n----------------------\nPatient: ${manualData.patientName}\nPatient ID: ${manualData.patientId || 'N/A'}\nPhone: ${manualData.phone || 'N/A'}\nAge: ${manualData.age}\nBP: ${manualData.bp || 'N/A'}\nBlood Group: ${manualData.bloodGroup || 'N/A'}\nDetails: ${manualData.details}\nDate: ${new Date().toLocaleString()}`;
    
    await fetch('/api/private-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_id: user.username,
        staff_name: user.name,
        content
      })
    });
    
    setShowManualForm(false);
    setManualData({ patientName: '', patientId: '', age: '', phone: '', bp: '', bloodGroup: '', details: '' });
    fetchPrivateData();
  };

  const renderContent = (item: PrivateData) => {
    const content = item.content;
    const lines = content.split('\n');
    let patientId: number | null = null;
    let patientName = '';

    // Try to extract Patient ID and Name
    lines.forEach(line => {
      if (line.startsWith('Patient ID:')) {
        const idStr = line.replace('Patient ID:', '').trim();
        if (idStr !== 'N/A') patientId = parseInt(idStr);
      }
      if (line.startsWith('Patient:')) {
        patientName = line.replace('Patient:', '').trim();
      }
    });

    // Clean content for display (remove the "MANUAL PATIENT RECORD" header)
    const displayContent = lines[0].includes('MANUAL PATIENT RECORD') 
      ? lines.slice(2).join('\n') 
      : content;

    if (patientName || patientId) {
      const isExpanded = expandedItems.has(item.id) || filterPatientId;
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-xs">
                {patientName ? patientName[0] : '?'}
              </div>
              <div>
                <button 
                  onClick={() => patientId && onSelectPatient(patientId, 'private')}
                  className={`font-bold text-sm text-left ${patientId ? 'text-emerald-400 hover:underline' : 'text-white/60'}`}
                  disabled={!patientId}
                >
                  {patientName || 'Unknown Patient'}
                </button>
                {patientId && <p className="text-[10px] text-white/30 uppercase tracking-widest">System ID: {patientId}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              {!filterPatientId && (
                <NeonButton 
                  onClick={() => toggleExpand(item.id)}
                  variant="outline" 
                  className="py-1 px-3 text-[10px] h-auto border-emerald-500/30"
                >
                  {isExpanded ? 'Hide Details' : 'View Details'}
                </NeonButton>
              )}
            </div>
          </div>
          
          {/* Show content if expanded or if on patient profile */}
          {isExpanded && (
            <pre className="text-sm text-white/80 bg-black/20 p-4 rounded-xl border border-white/5 font-mono whitespace-pre-wrap overflow-x-auto">
              {displayContent}
            </pre>
          )}
        </div>
      );
    }

    return (
      <pre className="text-sm text-white/80 bg-black/20 p-4 rounded-xl border border-white/5 font-mono whitespace-pre-wrap overflow-x-auto">
        {displayContent}
      </pre>
    );
  };

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto py-20">
        <GlassCard className="text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
            <Lock size={32} className="text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold">Private Data Vault</h2>
          <p className="text-white/40 text-sm">Enter the secure password to access private digital records.</p>
          
          <form onSubmit={handleUnlock} className="space-y-4">
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Vault Password"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-amber-500/50 outline-none transition-all text-center"
              autoFocus
            />
            <div className="flex gap-3">
              <NeonButton variant="outline" className="flex-1" onClick={onBack}>Back</NeonButton>
              <NeonButton className="flex-1 bg-amber-600/20 border-amber-500/50 text-amber-400 hover:bg-amber-600/40">Unlock Vault</NeonButton>
            </div>
          </form>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Unlock size={24} className="text-emerald-400" /> Private Data Vault
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-white/40 uppercase tracking-widest">
            {filterPatientId ? `Filtered by Patient ID: ${filterPatientId}` : 'Viewing All Records'}
          </p>
          {filterPatientId && (
            <button 
              onClick={() => onBack()} 
              className="text-[10px] text-emerald-400 uppercase font-bold hover:underline"
            >
              Clear Filter
            </button>
          )}
          <NeonButton onClick={() => setShowManualForm(true)} className="bg-emerald-500/20 border-emerald-500/50 text-emerald-400">
            <Plus size={18} className="mr-2" /> Manual Entry
          </NeonButton>
          <NeonButton variant="outline" onClick={() => setUnlocked(false)}>Lock Vault</NeonButton>
        </div>
      </div>

      <AnimatePresence>
        {showManualForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <GlassCard className="border-emerald-500/30">
              <h3 className="text-lg font-bold mb-4">Manual Patient Record Entry</h3>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Patient Name</label>
                    <input 
                      required
                      type="text"
                      value={manualData.patientName}
                      onChange={(e) => setManualData({ ...manualData, patientName: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Patient ID (Optional)</label>
                    <input 
                      type="text"
                      value={manualData.patientId}
                      onChange={(e) => setManualData({ ...manualData, patientId: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                      placeholder="e.g. 101"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Age</label>
                    <input 
                      required
                      type="number"
                      value={manualData.age}
                      onChange={(e) => setManualData({ ...manualData, age: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Phone</label>
                    <input 
                      type="text"
                      value={manualData.phone}
                      onChange={(e) => setManualData({ ...manualData, phone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">BP</label>
                    <input 
                      type="text"
                      value={manualData.bp}
                      onChange={(e) => setManualData({ ...manualData, bp: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                      placeholder="e.g. 120/80"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Blood Group</label>
                    <input 
                      type="text"
                      value={manualData.bloodGroup}
                      onChange={(e) => setManualData({ ...manualData, bloodGroup: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                      placeholder="e.g. O+"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Medical Details / Notes</label>
                  <textarea 
                    required
                    value={manualData.details}
                    onChange={(e) => setManualData({ ...manualData, details: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm min-h-[100px]"
                    placeholder="Enter symptoms, or medications..."
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <NeonButton variant="outline" onClick={() => setShowManualForm(false)}>Cancel</NeonButton>
                  <NeonButton type="submit">Save Record</NeonButton>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="animate-spin text-emerald-400 mx-auto mb-4" size={48} />
          <p className="text-white/40">Loading secure records...</p>
        </div>
      ) : data.length === 0 ? (
        <GlassCard className="text-center py-20">
          <ShieldAlert size={48} className="text-white/10 mx-auto mb-4" />
          <p className="text-white/40">No private records found.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {data.map((item) => (
            <GlassCard key={item.id} className="group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">{item.staff_id}</span>
                    <span className="text-xs text-white/40">•</span>
                    <span className="text-xs text-white/40">{item.staff_name}</span>
                  </div>
                  <p className="text-[10px] text-white/20 uppercase tracking-widest">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setEditingItem(item); setEditContent(item.content); }}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all text-blue-400"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/50 transition-all text-red-400 disabled:opacity-50"
                  >
                    {deletingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              </div>
              
              {editingItem?.id === item.id ? (
                <div className="space-y-4">
                  <textarea 
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm font-mono min-h-[200px] outline-none focus:border-emerald-500/50"
                  />
                  <div className="flex gap-2 justify-end">
                    <NeonButton variant="outline" onClick={() => setEditingItem(null)}>Cancel</NeonButton>
                    <NeonButton onClick={handleUpdate}>Save Changes</NeonButton>
                  </div>
                </div>
              ) : (
                renderContent(item)
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

function PendingLabsReview({ user, onBack, onApprove }: { user: UserType, onBack: () => void, onApprove: () => void }) {
  const [pendingLabs, setPendingLabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pending-lab-results');
      const data = await res.json();
      if (Array.isArray(data)) setPendingLabs(data);
    } catch (error) {
      console.error('Error fetching pending labs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id: number) => {
    setApprovingId(id);
    try {
      const res = await fetch(`/api/pending-lab-results/${id}/approve`, {
        method: 'POST'
      });
      if (res.ok) {
        onApprove();
        fetchPending();
      }
    } catch (error) {
      console.error('Error approving lab result:', error);
    } finally {
      setApprovingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/pending-lab-results/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchPending();
    } catch (error) {
      console.error('Error deleting pending lab:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical size={24} className="text-blue-400" /> Pending Lab Results
        </h1>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="animate-spin text-blue-400 mx-auto mb-4" size={48} />
          <p className="text-white/40">Fetching pending reports...</p>
        </div>
      ) : pendingLabs.length === 0 ? (
        <GlassCard className="text-center py-20">
          <CheckCircle2 size={48} className="text-emerald-500/20 mx-auto mb-4" />
          <p className="text-white/40">No pending lab results to review.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {pendingLabs.map((lab) => (
            <GlassCard key={lab.id} className="group">
              <div className="flex flex-col md:flex-row gap-6">
                {lab.image_data && (
                  <div className="w-full md:w-48 h-48 rounded-xl overflow-hidden border border-white/10 bg-black/20">
                    <img 
                      src={lab.image_data} 
                      alt="Lab Report" 
                      className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                      onClick={() => window.open(lab.image_data)}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-white/90">{lab.patient_name}</h3>
                      <p className="text-xs text-white/40 uppercase tracking-widest">Patient ID: {lab.patient_id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">Scanned By</p>
                      <p className="text-xs font-medium text-blue-400">{lab.staff_name} ({lab.staff_id})</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-black/20 border border-white/5 font-mono text-sm whitespace-pre-wrap">
                    {lab.content}
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button 
                      onClick={() => handleDelete(lab.id)}
                      className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all"
                    >
                      Discard
                    </button>
                    <NeonButton 
                      onClick={() => handleApprove(lab.id)}
                      disabled={approvingId === lab.id}
                      className="bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                    >
                      {approvingId === lab.id ? <Loader2 size={16} className="animate-spin" /> : <><Shield size={16} className="mr-2" /> Approve & Move to Vault</>}
                    </NeonButton>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </motion.div>
  );
}
