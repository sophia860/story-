import { useState, useEffect } from 'react';
import { 
  auth, db 
} from './firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  updateDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  BookOpen, 
  Moon, 
  Heart, 
  User as UserIcon, 
  LogOut, 
  History, 
  Plus, 
  ChevronRight, 
  ChevronLeft,
  Loader2
} from 'lucide-react';
import Markdown from 'react-markdown';
import { 
  Story, 
  StoryMode, 
  StoryTone
} from './types';
import { 
  generateSingleStory, 
  generateStoryArc,
  generateStoryImage
} from './gemini';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<Story[]>([]);
  const [view, setView] = useState<'home' | 'create' | 'story' | 'history'>('home');
  const [generating, setGenerating] = useState(false);
  
  // Form State
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [mode, setMode] = useState<StoryMode>('single');
  const [tone, setTone] = useState<StoryTone>('BALANCED');
  const [parentInput, setParentInput] = useState('');
  const [timeframe, setTimeframe] = useState('1–2 weeks');
  
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [activeNight, setActiveNight] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, 'stories'),
        where('authorUid', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
        setStories(fetched);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleSignOut = () => signOut(auth);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !childName || !childAge || !parentInput) return;

    setGenerating(true);
    try {
      let title = '';
      let content = '';
      let parentScript = '';
      let arcData = '';
      let imagePrompt = '';

      if (mode === 'single') {
        const res = await generateSingleStory(parentInput, childName, childAge, tone);
        title = res.title;
        content = res.story;
        parentScript = res.parentScript;
        imagePrompt = res.imagePrompt;
      } else {
        const res = await generateStoryArc(parentInput, childName, childAge, timeframe, tone);
        title = res.arcTitle;
        arcData = JSON.stringify(res);
        content = res.overallParentNote;
        imagePrompt = res.imagePrompt;
      }

      const newStory: Omit<Story, 'id'> = {
        authorUid: user.uid,
        childName,
        childAge,
        parentInput,
        mode,
        timeframe: mode === 'arc' ? timeframe : undefined,
        tone,
        title,
        content,
        parentScript: mode === 'single' ? parentScript : undefined,
        createdAt: new Date().toISOString(),
        isArc: mode === 'arc',
        arcData: mode === 'arc' ? arcData : undefined,
      };

      const docRef = await addDoc(collection(db, 'stories'), newStory);
      const savedStory = { id: docRef.id, ...newStory };
      setActiveStory(savedStory);
      setView('story');
      setActiveNight(0);
      setGenerating(false); // Move this up so the user sees results immediately
      
      // Generate Cover Image ASYNCHRONOUSLY
      generateStoryImage(imagePrompt || title).then(async (coverImage) => {
        if (coverImage) {
          await updateDoc(doc(db, 'stories', docRef.id), { coverImage });
          // Update local state if we are still viewing this story
          setActiveStory(prev => prev && prev.id === docRef.id ? { ...prev, coverImage } : prev);
        }
      }).catch(err => console.error("Failed to generate image backgroundly:", err));

      // Clear form
      setChildName('');
      setChildAge('');
      setParentInput('');
    } catch (error) {
      console.error("Failed to generate story:", error);
      alert("I'm so sorry, something went wrong while writing your story. Please try again.");
      setGenerating(false);
    } 
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDFCF8]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C8B6A6]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FDFCF8] relative overflow-hidden dream-background">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#F5E8D3]/40 rounded-full blur-[120px] opacity-60 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-[#E8F1EB]/40 rounded-full blur-[120px] opacity-60 animate-pulse delay-700" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-10 relative z-10"
        >
          <div className="flex justify-center">
            <motion.div 
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
              className="w-24 h-24 bg-[#C8B6A6] rounded-[2rem] flex items-center justify-center shadow-2xl relative"
            >
              <Sparkles className="text-white w-10 h-10" />
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border-4 border-[#FDFCF8]">
                 <Moon className="w-5 h-5 text-[#C8B6A6]" />
              </div>
            </motion.div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-5xl font-serif font-bold text-[#3D3A35] tracking-tight">Spark</h1>
            <p className="text-xl text-[#6B655C]/80 font-serif italic leading-relaxed px-4">
              A gentle place where we find the softest words for your child's biggest feelings.
            </p>
          </div>

          <button
            onClick={handleSignIn}
            className="w-full py-5 bg-[#3D3A35] text-white rounded-2xl font-serif text-lg shadow-xl hover:bg-[#2D2A26] transition-all flex items-center justify-center gap-3 active:scale-[0.98] group"
          >
            <UserIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Begin with Google
          </button>
          
          <div className="pt-4">
            <p className="text-[10px] text-[#9E978E] uppercase tracking-[0.3em] font-bold">
              By Lemma • For parents, by hearts
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCF8] flex flex-col dream-background">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-[#EBE3D5]/50 glass sticky top-0 z-50">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView('home')}>
          <div className="w-10 h-10 bg-[#C8B6A6] rounded-xl flex items-center justify-center shadow-inner">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-bold text-2xl text-[#3D3A35] leading-none mb-1">Spark</span>
            <span className="text-[9px] font-bold text-[#C8B6A6] uppercase tracking-[0.2em] leading-none">by Lemma</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setView('history')}
            className="p-2 text-[#6B655C] hover:bg-black/5 rounded-lg transition-colors"
          >
            <History className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 pl-4 border-l border-[#EBE3D5]">
            <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-[#C8B6A6]" referrerPolicy="no-referrer" />
            <button onClick={handleSignOut} className="text-[#9E978E] hover:text-[#3D3A35] transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-12 py-8"
            >
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-serif font-bold text-[#3D3A35]">What's happening tonight?</h2>
                <p className="text-[#6B655C] max-w-lg mx-auto">
                  Every story starts with the truth of where you are right now. 
                  Tell us a little about what's going on.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button 
                  onClick={() => { setMode('single'); setView('create'); }}
                  className="group p-8 bg-white border border-[#EBE3D5] rounded-3xl text-left hover:border-[#C8B6A6] hover:shadow-xl transition-all duration-300"
                >
                  <div className="w-12 h-12 bg-[#F5E8D3] rounded-2xl flex items-center justify-center mb-6 text-[#8B7E6F] group-hover:scale-110 transition-transform">
                    <Moon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-serif font-bold mb-2">Single Bedtime Story</h3>
                  <p className="text-sm text-[#6B655C] leading-relaxed">
                    A calm, standalone story to help navigate a specific big feeling or event right now.
                  </p>
                  <div className="mt-6 flex items-center text-xs font-bold text-[#C8B6A6] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Create story <ChevronRight className="w-3 h-3 ml-1" />
                  </div>
                </button>

                <button 
                  onClick={() => { setMode('arc'); setView('create'); }}
                  className="group p-8 bg-white border border-[#EBE3D5] rounded-3xl text-left hover:border-[#C8B6A6] hover:shadow-xl transition-all duration-300"
                >
                  <div className="w-12 h-12 bg-[#E8F1EB] rounded-2xl flex items-center justify-center mb-6 text-[#6B8E7A] group-hover:scale-110 transition-transform">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-serif font-bold mb-2">Multi-Night Arc</h3>
                  <p className="text-sm text-[#6B655C] leading-relaxed">
                    A series of stories that walk a child slowly toward a big change over several nights.
                  </p>
                  <div className="mt-6 flex items-center text-xs font-bold text-[#C8B6A6] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Create arc <ChevronRight className="w-3 h-3 ml-1" />
                  </div>
                </button>
              </div>

              {stories.length > 0 && (
                <div className="pt-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-serif font-bold text-xl">Recent Words</h3>
                    <button onClick={() => setView('history')} className="text-sm font-bold text-[#C8B6A6] uppercase tracking-widest flex items-center gap-1">
                      Full Library <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {stories.slice(0, 2).map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => { setActiveStory(s); setView('story'); setActiveNight(0); }}
                        className="p-4 bg-white border border-[#EBE3D5] rounded-xl cursor-pointer hover:border-[#C8B6A6] transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {s.mode === 'single' ? <Moon className="w-3 h-3 text-[#8B7E6F]" /> : <BookOpen className="w-3 h-3 text-[#6B8E7A]" />}
                          <span className="text-[10px] font-bold text-[#9E978E] uppercase tracking-widest">{s.mode}</span>
                        </div>
                        <h4 className="font-serif font-bold mb-1 truncate">{s.title}</h4>
                        <p className="text-xs text-[#6B655C] truncate">For {s.childName}</p>
                        {s.coverImage && (
                          <div className="mt-3 aspect-[16/9] w-full rounded-lg overflow-hidden border border-[#EBE3D5]">
                            <img src={s.coverImage} alt="" className="w-full h-full object-cover grayscale-[20%] hover:grayscale-0 transition-all duration-700" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'create' && (
            <motion.div 
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto py-8"
            >
              <button 
                onClick={() => setView('home')}
                className="flex items-center gap-2 text-sm font-bold text-[#9E978E] uppercase tracking-widest mb-8 hover:text-[#3D3A35] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              <div className="space-y-8 bg-white p-8 rounded-3xl border border-[#EBE3D5] shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${mode === 'single' ? 'bg-[#F5E8D3] text-[#8B7E6F]' : 'bg-[#E8F1EB] text-[#6B8E7A]'}`}>
                    {mode === 'single' ? <Moon className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif font-bold">{mode === 'single' ? 'Write a Story' : 'Build a Story Arc'}</h2>
                    <p className="text-sm text-[#6B655C]">Finalize the details for your therapeutic journey.</p>
                  </div>
                </div>

                <form onSubmit={handleGenerate} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#9E978E] uppercase tracking-widest pl-1">Child's Name</label>
                      <input 
                        type="text" 
                        required
                        value={childName}
                        onChange={(e) => setChildName(e.target.value)}
                        placeholder="e.g. Maya"
                        className="w-full p-4 bg-[#F9F8F4] border-none rounded-xl focus:ring-2 focus:ring-[#C8B6A6] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#9E978E] uppercase tracking-widest pl-1">Child's Age</label>
                      <input 
                        type="text" 
                        required
                        value={childAge}
                        onChange={(e) => setChildAge(e.target.value)}
                        placeholder="e.g. a 4 year old"
                        className="w-full p-4 bg-[#F9F8F4] border-none rounded-xl focus:ring-2 focus:ring-[#C8B6A6] transition-all"
                      />
                    </div>
                  </div>

                  {mode === 'arc' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#9E978E] uppercase tracking-widest pl-1 text-xs">How long do we have to prepare?</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['A few days', '1–2 weeks', 'A month or more'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTimeframe(t)}
                            className={`p-3 rounded-xl text-xs font-medium border transition-all ${timeframe === t ? 'bg-[#3D3A35] text-white border-[#3D3A35]' : 'bg-white text-[#6B655C] border-[#EBE3D5]'}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#9E978E] uppercase tracking-widest pl-1">Emotional Tone</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['VERY GENTLE', 'BALANCED', 'HONEST AND BRAVE'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTone(t)}
                          className={`p-3 rounded-xl text-[10px] font-bold tracking-tight border transition-all ${tone === t ? 'bg-[#3D3A35] text-white border-[#3D3A35]' : 'bg-white text-[#6B655C] border-[#EBE3D5]'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#9E978E] uppercase tracking-widest pl-1">What's the situation?</label>
                    <textarea 
                      required
                      value={parentInput}
                      onChange={(e) => setParentInput(e.target.value)}
                      placeholder="e.g. We are moving house next week and she's feeling very worried about her new bedroom..."
                      className="w-full p-4 bg-[#F9F8F4] border-none rounded-xl focus:ring-2 focus:ring-[#C8B6A6] transition-all min-h-[150px] resize-none"
                    />
                    <p className="text-[10px] text-[#9E978E] italic">Be as specific and honest as you need. Gemini will weave your details into the story.</p>
                  </div>

                  <button
                    disabled={generating}
                    className={`w-full py-5 bg-[#3D3A35] text-white rounded-2xl font-serif font-bold text-lg shadow-lg hover:bg-[#2D2A26] transition-all flex items-center justify-center gap-3 disabled:opacity-70 active:scale-[0.98] ${generating ? 'cursor-not-allowed' : ''}`}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Writing your story...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate Story
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'story' && activeStory && (
            <motion.div 
              key="story-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 space-y-8"
            >
               <div className="flex items-center justify-between">
                <button 
                  onClick={() => setView('home')}
                  className="flex items-center gap-2 text-sm font-bold text-[#9E978E] uppercase tracking-widest hover:text-[#3D3A35] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Home
                </button>
                <div className="flex items-center gap-2">
                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeStory.mode === 'single' ? 'bg-[#F5E8D3] text-[#8B7E6F]' : 'bg-[#E8F1EB] text-[#6B8E7A]'}`}>
                    {activeStory.mode === 'single' ? <Moon className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-bold text-[#9E978E] uppercase tracking-widest">{activeStory.mode}</span>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-[#EBE3D5] shadow-2xl overflow-hidden">
                {activeStory.coverImage && (
                  <div className="aspect-[21/9] w-full overflow-hidden border-b border-[#EBE3D5] relative">
                    <img src={activeStory.coverImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent pointer-events-none" />
                  </div>
                )}
                {activeStory.isArc ? (
                  /* ARC VIEW */
                  <div>
                    <div className="p-8 border-b border-[#EBE3D5] bg-[#F9F8F4]">
                      <h2 className="text-3xl font-serif font-bold mb-4">{activeStory.title}</h2>
                      <div className="parent-note">
                        <Markdown>{activeStory.content}</Markdown>
                      </div>
                    </div>

                    <div className="p-8">
                      {(() => {
                        const arc = JSON.parse(activeStory.arcData || '{}');
                        const night = arc.nights[activeNight];
                        return (
                          <div className="space-y-12">
                            <div className="flex items-center justify-between mb-8">
                              <h3 className="text-xs font-bold text-[#C8B6A6] uppercase tracking-widest">Night {activeNight + 1} of {arc.nights.length}</h3>
                              <div className="flex gap-2">
                                <button 
                                  disabled={activeNight === 0}
                                  onClick={() => setActiveNight(prev => prev - 1)}
                                  className="p-2 rounded-lg bg-[#F5F1E9] disabled:opacity-30"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button 
                                  disabled={activeNight === arc.nights.length - 1}
                                  onClick={() => setActiveNight(prev => prev + 1)}
                                  className="p-2 rounded-lg bg-[#F5F1E9] disabled:opacity-30"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <motion.div 
                              key={`night-${activeNight}`}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="space-y-8"
                            >
                               <h4 className="text-2xl font-serif font-bold text-center italic">{night.title}</h4>
                               <div className="story-content text-lg font-serif px-4 md:px-12 max-w-none">
                                 <Markdown>{night.story}</Markdown>
                               </div>
                            </motion.div>

                            <div className="p-6 bg-[#F9F8F4] rounded-2xl border border-[#EBE3D5] mt-12">
                              <h5 className="text-[10px] font-bold text-[#9E978E] uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                <Heart className="w-3 h-3" /> Tonight's Note for You
                              </h5>
                              <div className="text-sm text-[#6B655C] leading-relaxed italic">
                                <Markdown>{night.parentNote}</Markdown>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                ) : (
                  /* SINGLE VIEW */
                  <div className="p-8 md:p-12">
                    <div className="max-w-prose mx-auto space-y-12">
                      <h2 className="text-4xl font-serif font-bold text-center mb-12">{activeStory.title}</h2>
                      
                      <div className="story-content text-xl font-serif leading-loose">
                        <Markdown>{activeStory.content}</Markdown>
                      </div>

                      <div className="pt-16 border-t border-[#EBE3D5] space-y-8">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-[#3D3A35] rounded-full flex items-center justify-center shrink-0">
                             <UserIcon className="text-white w-5 h-5" />
                           </div>
                           <h3 className="font-serif font-bold text-xl">The Parent Script</h3>
                        </div>

                        <div className="space-y-6 text-[#6B655C]">
                          <Markdown>{activeStory.parentScript || ''}</Markdown>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8"
            >
               <button 
                onClick={() => setView('home')}
                className="flex items-center gap-2 text-sm font-bold text-[#9E978E] uppercase tracking-widest mb-8 hover:text-[#3D3A35] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Home
              </button>

              <h2 className="text-3xl font-serif font-bold mb-8">Your Library</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stories.length === 0 ? (
                  <div className="col-span-full py-20 text-center space-y-4 text-[#9E978E]">
                    <Plus className="w-8 h-8 mx-auto opacity-20" />
                    <p>No stories yet. Start by creating one for your child.</p>
                  </div>
                ) : (
                  stories.map(s => (
                    <div 
                      key={s.id} 
                      onClick={() => { setActiveStory(s); setView('story'); setActiveNight(0); }}
                      className="group bg-white rounded-3xl border border-[#EBE3D5] cursor-pointer hover:border-[#C8B6A6] transition-all hover:shadow-2xl overflow-hidden flex flex-col"
                    >
                      {s.coverImage && (
                        <div className="aspect-[16/9] w-full overflow-hidden border-b border-[#EBE3D5]">
                          <img src={s.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.mode === 'single' ? 'bg-[#F5E8D3] text-[#8B7E6F]' : 'bg-[#E8F1EB] text-[#6B8E7A]'}`}>
                            {s.mode === 'single' ? <Moon className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                          </div>
                          <span className="text-[9px] font-bold text-[#9E978E] uppercase tracking-[0.2em]">{new Date(s.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-serif font-bold text-lg mb-2 group-hover:text-[#3D3A35] transition-colors">{s.title}</h3>
                        <p className="text-xs text-[#6B655C]">For {s.childName} • {s.childAge}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="p-12 text-center border-t border-[#EBE3D5]/50 mt-12 bg-white/30 backdrop-blur-sm">
        <div className="max-w-xs mx-auto space-y-4">
          <div className="w-8 h-8 bg-[#C8B6A6] rounded-lg flex items-center justify-center mx-auto opacity-50">
            <Sparkles className="text-white w-4 h-4" />
          </div>
          <p className="text-[10px] text-[#9E978E] uppercase tracking-[0.3em] font-bold">
            Spark by Lemma
          </p>
          <p className="text-xs text-[#9E978E] italic px-4">
            Helping little hearts find their way to sleep, one gentle word at a time.
          </p>
        </div>
      </footer>
    </div>
  );
}
