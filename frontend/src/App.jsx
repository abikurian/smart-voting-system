import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import { 
  Fingerprint, 
  UserPlus, 
  RefreshCw, 
  ShieldCheck, 
  Database,
  ArrowRight,
  Sparkles,
  FileCheck2,
  ScanEye,
  Info,
  Check,
  UserCheck,
  Vote,
  CircleDot,
  Loader2
} from 'lucide-react';

const CANDIDATES = [
  { id: 'alpha', name: 'Candidate Alpha', party: 'Technocratic Progress Party', tag: 'TPP', color: 'from-blue-500 to-indigo-600' },
  { id: 'beta', name: 'Candidate Beta', party: 'Green Democracy Coalition', tag: 'GDC', color: 'from-emerald-500 to-teal-600' },
  { id: 'gamma', name: 'Candidate Gamma', party: 'Cyber Liberty Front', tag: 'CLF', color: 'from-purple-500 to-pink-600' }
];

function App() {
  const [activeTab, setActiveTab] = useState('vote'); // 'vote' or 'register'
  const [backendStatus, setBackendStatus] = useState('checking'); // 'connected', 'disconnected', 'checking'
  
  // Registration Form State
  const [regId, setRegId] = useState('');
  const [regName, setRegName] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regMessage, setRegMessage] = useState(null);
  
  // Verification & Ballot State
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState(null);
  const [verifiedVoter, setVerifiedVoter] = useState(null); // { id, name }
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [votingLoading, setVotingLoading] = useState(false);
  const [voteMessage, setVoteMessage] = useState(null);
  const [voteSuccess, setVoteSuccess] = useState(false);

  const webcamRef = useRef(null);

  // Health check polling
  const checkBackendHealth = async () => {
    try {
      await fetch('http://localhost:8000/', { mode: 'no-cors' });
      setBackendStatus('connected');
    } catch (error) {
      setBackendStatus('disconnected');
    }
  };

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Helper to convert base64 image data to a File object
  const getFileFromWebcam = async () => {
    try {
      if (!webcamRef.current) {
        console.warn("Webcam ref is null.");
        return null;
      }
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        console.warn("Webcam screenshot is null.");
        return null;
      }
      
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      return new File([blob], 'voter_capture.jpg', { type: 'image/jpeg' });
    } catch (error) {
      console.error("Webcam capture process failed:", error);
      return null;
    }
  };

  // Handle Registration
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regId || !regName) {
      setRegMessage({ type: 'error', text: 'Voter Registration ID and Legal Name are required.' });
      return;
    }

    setRegLoading(true);
    setRegMessage(null);

    try {
      const file = await getFileFromWebcam();
      if (!file) {
        setRegMessage({ type: 'error', text: 'Webcam capture failed. Ensure camera permissions are active.' });
        setRegLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('voter_id', regId.trim());
      formData.append('name', regName.trim());
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/register', {
        method: 'POST',
        body: formData,
      });

      let data;
      try {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { detail: text || `Server returned error status: ${response.status}` };
        }
      } catch (err) {
        data = { detail: 'Failed to read response stream.' };
      }

      if (response.ok) {
        setRegMessage({ type: 'success', text: data.message || 'Voter registration complete.' });
        setRegId('');
        setRegName('');
      } else {
        setRegMessage({ type: 'error', text: data.detail || 'Enrollment registration rejected.' });
      }
    } catch (err) {
      console.error("Enrollment connection error:", err);
      setRegMessage({ type: 'error', text: 'Secure voting node is offline. Ensure uvicorn backend is running.' });
    } finally {
      setRegLoading(false);
    }
  };

  // Handle Verification
  const handleVerify = async () => {
    setVerifyLoading(true);
    setVerifyMessage(null);
    setVerifiedVoter(null);

    try {
      const file = await getFileFromWebcam();
      if (!file) {
        setVerifyMessage({ type: 'error', text: 'Webcam capture failed. Verify camera setup and permissions.' });
        setVerifyLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/verify', {
        method: 'POST',
        body: formData,
      });

      let data;
      try {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { detail: text || `Server returned error status: ${response.status}` };
        }
      } catch (err) {
        data = { detail: 'Failed to read response stream.' };
      }

      if (response.ok) {
        setVerifiedVoter({ id: data.voter_id, name: data.name });
        setVerifyMessage({ type: 'success', text: `Identity Verified: ${data.name}` });
      } else {
        setVerifyMessage({ type: 'error', text: data.detail || 'Biometric signature not recognized.' });
      }
    } catch (err) {
      console.error("Verification connection error:", err);
      setVerifyMessage({ type: 'error', text: 'Secure voting node is offline. Ensure uvicorn backend is running.' });
    } finally {
      setVerifyLoading(false);
    }
  };

  // Handle Vote Submission
  const handleCastVote = async () => {
    if (!verifiedVoter || !selectedCandidate) return;

    setVotingLoading(true);
    setVoteMessage(null);

    try {
      const formData = new FormData();
      formData.append('voter_id', verifiedVoter.id);
      formData.append('candidate', selectedCandidate.name);

      const response = await fetch('http://localhost:8000/cast-vote', {
        method: 'POST',
        body: formData,
      });

      let data;
      try {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { detail: text || `Server returned error status: ${response.status}` };
        }
      } catch (err) {
        data = { detail: 'Failed to parse response stream.' };
      }

      if (response.ok) {
        setVoteSuccess(true);
        setVoteMessage({ type: 'success', text: data.message || 'Ballot logged successfully.' });
      } else {
        setVoteMessage({ type: 'error', text: data.detail || 'Ballot logging transaction rejected.' });
      }
    } catch (err) {
      console.error("Ballot submit connection error:", err);
      setVoteMessage({ type: 'error', text: 'Node connection lost during ballot transmission.' });
    } finally {
      setVotingLoading(false);
    }
  };

  // Reset voting portal state
  const resetPortal = () => {
    setVerifiedVoter(null);
    setSelectedCandidate(null);
    setVoteMessage(null);
    setVerifyMessage(null);
    setVoteSuccess(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-16 space-y-10 text-slate-900">
      
      {/* Light Theme Header Bar */}
      <header className="sticky top-4 z-40 flex flex-col sm:flex-row items-center justify-between p-5 rounded-2xl bg-peach border border-skyblue transition-all duration-300">
        <div className="flex items-center space-x-3.5 mb-4 sm:mb-0">
          <div className="bg-mediumblue/15 p-2.5 rounded-xl border border-mediumblue/30 text-slate-800">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none m-0">VoteChain</h1>
            <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest mt-1">Biometric Ballot Protocol</p>
          </div>
        </div>

        {/* Server Connection Status Indicator */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2.5 bg-white/60 px-4 py-2 rounded-full border border-skyblue">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                backendStatus === 'connected' ? 'bg-emerald-500' : backendStatus === 'disconnected' ? 'bg-rose-500' : 'bg-amber-500'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                backendStatus === 'connected' ? 'bg-emerald-600' : backendStatus === 'disconnected' ? 'bg-rose-600' : 'bg-amber-600'
              }`}></span>
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-800 tracking-wider">
              {backendStatus === 'connected' ? 'SECURE_NODE_ONLINE' : backendStatus === 'disconnected' ? 'SECURE_NODE_OFFLINE' : 'CONNECTING_TO_NODE...'}
            </span>
          </div>

          <button 
            onClick={checkBackendHealth} 
            className="p-2 rounded-lg bg-white/60 hover:bg-skyblue/30 border border-skyblue text-slate-700 hover:text-slate-950 transition-all duration-200 cursor-pointer"
            title="Refresh connection status"
          >
            <RefreshCw size={14} className={backendStatus === 'checking' ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Single Column Layout Container */}
      <main className="space-y-8">
        
        {/* Navigation Section Picker */}
        <nav className="flex p-1.5 rounded-2xl bg-peach border border-skyblue max-w-md mx-auto">
          <button
            onClick={() => { setActiveTab('vote'); resetPortal(); }}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === 'vote'
                ? 'bg-mediumblue text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-skyblue/35'
            }`}
          >
            <Fingerprint size={15} />
            <span>Ballot Portal</span>
          </button>
          <button
            onClick={() => { setActiveTab('register'); setRegMessage(null); }}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-mediumblue text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-skyblue/35'
            }`}
          >
            <UserPlus size={15} />
            <span>Enroll Voter</span>
          </button>
        </nav>

        {/* Dynamic Scanning Module (Integrated Camera Box) */}
        {(!voteSuccess) && (
          <section className="dashboard-card rounded-2xl p-6 md:p-8 space-y-6 max-w-2xl mx-auto transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">Biometric Scanner</h3>
                <h2 className="text-sm font-semibold text-slate-900 mt-1">Live Capture Interface</h2>
              </div>
              <span className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-800 bg-mediumblue/15 px-2.5 py-1 rounded-md border border-mediumblue/30">
                <ScanEye size={12} />
                <span>CAMERA RUNNING</span>
              </span>
            </div>

            {/* Webcam Window with light-theme scan targets */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-skyblue shadow-inner group">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {/* Enhanced Scan Perimeter Targeting Ring & Corners */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-64 h-64 rounded-3xl border border-mediumblue/25 scan-perimeter flex items-center justify-center">
                  
                  {/* Glowing Corners */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-mediumblue rounded-tl-2xl scan-corner"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-mediumblue rounded-tr-2xl scan-corner"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-mediumblue rounded-bl-2xl scan-corner"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-mediumblue rounded-br-2xl scan-corner"></div>

                  {/* Vertical Glowing Laser Sweep Line */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-mediumblue to-transparent scan-laser shadow-[0_0_15px_rgba(140,192,235,1.0)] opacity-95"></div>

                  {/* Target Scanner overlay metadata */}
                  <div className="absolute top-3 left-4 text-[9px] font-mono text-slate-200 font-bold flex items-center space-x-1 bg-slate-950/80 px-2 py-0.5 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-mediumblue scan-dot"></span>
                    <span>ALIGN FACE</span>
                  </div>
                  <div className="absolute bottom-3 right-4 text-[9px] font-mono text-slate-300 font-bold bg-slate-950/80 px-2 py-0.5 rounded">
                    <span>SYS_BIO_V2.0</span>
                  </div>
                </div>
              </div>

              {/* Ambient scan readout borders */}
              <div className="absolute top-4 left-4 font-mono text-[9px] text-slate-400 select-none bg-slate-950/70 px-1.5 py-0.5 rounded">
                LOC: 127.0.0.1 // PORT: 8000
              </div>
              <div className="absolute top-4 right-4 font-mono text-[9px] text-slate-400 select-none bg-slate-950/70 px-1.5 py-0.5 rounded">
                FPS: 30 // ISO: AUTO
              </div>
            </div>
            
            <div className="flex items-center space-x-2.5 bg-white/40 p-3.5 rounded-xl border border-skyblue text-slate-800">
              <Info size={16} className="text-slate-800 shrink-0" />
              <p className="text-xs leading-relaxed font-medium">
                Position your face within the scanner frame. Ensure neutral lighting for biometric verification.
              </p>
            </div>
          </section>
        )}

        {/* View Section Panels */}
        <section className="max-w-2xl mx-auto">
          
          {/* VIEW 1: BALLOT PORTAL */}
          {activeTab === 'vote' && (
            <div className="space-y-6">
              
              {/* PHASE 1: Identity Biometric Check */}
              {!verifiedVoter && (
                <div className="dashboard-card rounded-2xl p-6 md:p-8 space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2.5">
                      <Fingerprint size={20} className="text-slate-800" />
                      <span>Biometric Authentication</span>
                    </h2>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      Retrieve your voting token by verifying your biometrics. The model processes face features to check enrollment.
                    </p>
                  </div>

                  {verifyMessage && (
                    <div className={`p-4 rounded-xl flex items-start space-x-3 border ${
                      verifyMessage.type === 'success' 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800' 
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-800'
                    }`}>
                      <Info className="shrink-0 mt-0.5" size={16} />
                      <span className="text-xs font-bold">{verifyMessage.text}</span>
                    </div>
                  )}

                  <button
                    onClick={handleVerify}
                    disabled={verifyLoading || backendStatus !== 'connected'}
                    className="w-full py-3.5 px-5 bg-mediumblue hover:bg-mediumblue/85 disabled:bg-slate-300 disabled:text-slate-500 text-slate-900 font-bold text-sm rounded-xl border border-mediumblue shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {verifyLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Matching Signatures...</span>
                      </>
                    ) : (
                      <>
                        <span>Scan & Verify Identity</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* PHASE 2: Candidate Voting Cards Panel */}
              {verifiedVoter && !voteSuccess && (
                <div className="dashboard-card-glow rounded-2xl p-6 md:p-8 space-y-6">
                  
                  {/* Verified Header Details */}
                  <div className="flex items-center justify-between border-b border-skyblue pb-5">
                    <div className="flex items-center space-x-3.5">
                      <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/30 text-emerald-700 shadow-sm">
                        <UserCheck size={20} />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-700 uppercase font-bold tracking-wider block">Identity Verified</span>
                        <h4 className="text-base font-bold text-slate-900 mt-0.5">{verifiedVoter.name} <span className="text-xs text-slate-600 font-mono font-normal">({verifiedVoter.id})</span></h4>
                      </div>
                    </div>
                    <button
                      onClick={resetPortal}
                      className="text-xs text-slate-700 hover:text-slate-950 font-bold bg-white/60 hover:bg-skyblue border border-skyblue px-3.5 py-2 rounded-xl transition-all duration-200 cursor-pointer shadow-sm"
                    >
                      Lock Session
                    </button>
                  </div>

                  {/* Candidate Selection List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Select Candidate</h3>
                      {selectedCandidate && (
                        <span className="text-[10px] font-bold text-slate-800 flex items-center space-x-1">
                          <Sparkles size={11} />
                          <span>Candidate Chosen</span>
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      {CANDIDATES.map((candidate) => {
                        const isSelected = selectedCandidate?.id === candidate.id;
                        return (
                          <button
                            key={candidate.id}
                            onClick={() => setSelectedCandidate(candidate)}
                            className={`w-full p-5 text-left rounded-xl transition-all duration-200 border flex items-center justify-between group relative overflow-hidden cursor-pointer ${
                              isSelected
                                ? 'bg-mediumblue/25 border-mediumblue shadow-sm'
                                : 'bg-white/50 border-skyblue hover:border-mediumblue hover:bg-white/85'
                            }`}
                          >
                            <div className="flex items-center space-x-4 z-10">
                              {/* Party Emblem styling */}
                              <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${candidate.color} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                                {candidate.tag}
                              </div>
                              <div>
                                <h5 className="font-bold text-slate-900 text-sm group-hover:text-slate-950 transition-colors duration-200">{candidate.name}</h5>
                                <p className="text-xs text-slate-600 mt-1 leading-none">{candidate.party}</p>
                              </div>
                            </div>

                            <div className="z-10 flex items-center space-x-3">
                              <span className="text-[10px] font-mono text-slate-600 uppercase font-semibold">Ballot #{candidate.id.toUpperCase()}</span>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                isSelected ? 'border-mediumblue bg-mediumblue text-slate-900 shadow-inner' : 'border-slate-400 group-hover:border-slate-600'
                              }`}>
                                {isSelected && <Check size={12} strokeWidth={3} className="text-slate-900" />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submission Ballot Actions */}
                  <div className="space-y-4 pt-5 border-t border-skyblue">
                    {voteMessage && (
                      <div className={`p-4 rounded-xl flex items-start space-x-3 border ${
                        voteMessage.type === 'success' 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800' 
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-800'
                      }`}>
                        <Info className="shrink-0 mt-0.5" size={16} />
                        <span className="text-xs font-bold">{voteMessage.text}</span>
                      </div>
                    )}

                    <button
                      onClick={handleCastVote}
                      disabled={!selectedCandidate || votingLoading}
                      className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center space-x-2.5"
                    >
                      {votingLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Encrypting Ballot Transaction...</span>
                        </>
                      ) : (
                        <>
                          <Vote size={16} />
                          <span>Cast Secure Ballot</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 1 SUCCESS: Ballot Locked State */}
              {voteSuccess && (
                <div className="dashboard-card rounded-2xl p-6 md:p-8 text-center space-y-6">
                  <div className="mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-700 shadow-md">
                    <FileCheck2 size={30} className="animate-bounce" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-bold text-slate-900 font-bold">Ballot Submitted & Confirmed</h2>
                    <p className="text-xs text-slate-700 leading-relaxed max-w-sm mx-auto font-medium">
                      Your vote transaction has been signed with your facial biometric hash and securely logged in the local SQL database.
                    </p>
                  </div>

                  <div className="p-4 bg-white/70 border border-skyblue rounded-xl max-w-xs mx-auto text-left space-y-1">
                    <div className="text-[10px] text-emerald-700 uppercase font-bold tracking-wider">Ballot Receipt Code</div>
                    <div className="text-xs font-mono text-slate-900 font-bold break-all">
                      {Math.random().toString(36).substring(2, 10).toUpperCase()}-{Math.random().toString(36).substring(2, 10).toUpperCase()}
                    </div>
                  </div>

                  <button
                    onClick={resetPortal}
                    className="py-3 px-6 bg-mediumblue hover:bg-mediumblue/80 text-slate-900 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all duration-200 cursor-pointer"
                  >
                    Lock Session
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: VOTER ENROLLMENT FORM */}
          {activeTab === 'register' && (
            <div className="dashboard-card rounded-2xl p-6 md:p-8 space-y-6">
              <div className="space-y-2 border-b border-skyblue pb-5">
                <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2.5">
                  <UserPlus size={20} className="text-slate-800" />
                  <span>Voter Enrollment Protocol</span>
                </h2>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  Enroll new voter coordinates by assigning a unique identification sequence and binding their facial feature vector mapping.
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="voterId" className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Voter Registration ID
                    </label>
                    <input
                      id="voterId"
                      type="text"
                      placeholder="e.g. VOTE-9902"
                      value={regId}
                      onChange={(e) => setRegId(e.target.value)}
                      className="w-full py-3 px-4 rounded-xl text-slate-900 placeholder-slate-400 text-sm dashboard-input transition-all duration-200"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="voterName" className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Full Legal Name
                    </label>
                    <input
                      id="voterName"
                      type="text"
                      placeholder="e.g. Jane Doe"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full py-3 px-4 rounded-xl text-slate-900 placeholder-slate-400 text-sm dashboard-input transition-all duration-200"
                      required
                    />
                  </div>
                </div>

                {regMessage && (
                  <div className={`p-4 rounded-xl flex items-start space-x-3 border ${
                    regMessage.type === 'success' 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800' 
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-800'
                  }`}>
                    <Info className="shrink-0 mt-0.5" size={16} />
                    <span className="text-xs font-bold">{regMessage.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={regLoading || backendStatus !== 'connected'}
                  className="w-full py-3.5 px-5 bg-mediumblue hover:bg-mediumblue/85 disabled:bg-slate-300 disabled:text-slate-500 text-slate-900 font-bold text-sm rounded-xl border border-mediumblue shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center space-x-2"
                >
                  {regLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Extracting Biometric Vector...</span>
                    </>
                  ) : (
                    <>
                      <Database size={16} />
                      <span>Enroll and Register Voter</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
