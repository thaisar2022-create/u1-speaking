import React, { useState, useEffect, useRef } from 'react';
import {
  words,
  sentences,
  qaLessons,
  grammarGroups,
  rearrangeLessons,
  quizQuestions,
  blanks,
  schoolPhonetics,
  VocabItem
} from './data/thaiSarData';

export default function App() {
  // Navigation
  const [page, setPage] = useState<'home' | 'learn' | 'practice' | 'flash' | 'settings'>('home');

  // Learn state
  const [learnTab, setLearnTab] = useState<'Words' | 'Sentences' | 'Q & A' | 'Grammar'>('Words');
  const [learnIndex, setLearnIndex] = useState(0);
  const [qaIndex, setQaIndex] = useState(0);

  // Flashcards state
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashBack, setFlashBack] = useState(false);

  // Practice state
  const [practice, setPractice] = useState<'quiz' | 'blank' | 'rearrange'>('quiz');
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizResponses, setQuizResponses] = useState<{ index: number; choice: number; correct: boolean }[]>([]);
  const [quizScore, setQuizScore] = useState(0);

  // Blank state
  const [blankIndex, setBlankIndex] = useState(0);
  const [blankInput, setBlankInput] = useState('');
  const [blankFeedback, setBlankFeedback] = useState<{ checked: boolean; ok: boolean } | null>(null);

  // Rearrange state
  const [reorderIndex, setReorderIndex] = useState(0);
  const [reorderPicked, setReorderPicked] = useState<number[]>([]);
  const [reorderChecked, setReorderChecked] = useState(false);

  // Audio & Settings state
  const [speed, setSpeed] = useState<number>(() => {
    const saved = localStorage.getItem('thaiSpeed');
    return saved ? parseFloat(saved) : 0.85;
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [detectedVoice, setDetectedVoice] = useState('Checking Thai voice...');

  // Progress state
  const [done, setDone] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('thaiDone');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Recording state
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  const [recordedAudios, setRecordedAudios] = useState<Record<string, string>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize SpeechSynthesis voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        const thaiVoices = voices.filter(v => v.lang.toLowerCase().startsWith('th'));
        if (thaiVoices.length > 0) {
          setDetectedVoice(thaiVoices.map(v => `${v.name} (${v.lang})`).join(', '));
        } else {
          setDetectedVoice('No Thai voice is currently detected on this device. Fallback may be used.');
        }
      } else {
        setDetectedVoice('Speech synthesis not supported on this browser.');
      }
    };

    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Mark task done and update localStorage
  const mark = (key: string) => {
    setDone(prev => {
      if (prev.includes(key)) return prev;
      const updated = [...prev, key];
      localStorage.setItem('thaiDone', JSON.stringify(updated));
      return updated;
    });
  };

  const progressPercent = Math.min(100, Math.round((done.length / 70) * 100));

  // Speech synthesis
  const speak = (text: string, customSpeed?: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('ဤဖုန်းတွင် စာသားမှ အသံဖတ်သည့်စနစ် မရရှိပါ။');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = customSpeed ?? speed;

    const voices = window.speechSynthesis.getVoices();
    const thVoice = voices.find(v => v.lang.toLowerCase() === 'th-th') ||
                    voices.find(v => v.lang.toLowerCase().startsWith('th'));
    if (thVoice) {
      utterance.voice = thVoice;
    } else {
      setStatusMessage('Thai voice not found. Your phone may use a fallback voice. For accurate Thai tones, use recorded audio in the production app.');
    }
    window.speechSynthesis.speak(utterance);
  };

  // Recording handler
  const toggleRecord = async (id: string) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setCurrentRecordingId(null);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert('Recording requires microphone permissions and a supported browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      audioChunksRef.current = [];
      setCurrentRecordingId(id);

      rec.ondataavailable = e => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedAudios(prev => ({
          ...prev,
          [id]: url
        }));
        setCurrentRecordingId(null);
      };

      mediaRecorderRef.current = rec;
      rec.start();
    } catch (err: any) {
      alert('Microphone permission unavailable: ' + (err.message || err));
      setCurrentRecordingId(null);
    }
  };

  const navigateTo = (newPage: 'home' | 'learn' | 'practice' | 'flash' | 'settings') => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper for vocab action buttons
  const renderActions = (item: VocabItem | [string, string, string], withRecord = true, recId = 'main') => {
    const thai = Array.isArray(item) ? item[0] : item.thai;
    const isRecording = currentRecordingId === recId;
    const recordedUrl = recordedAudios[recId];

    return (
      <>
        <div className="controls">
          <button className="btn" type="button" onClick={() => speak(thai)}>
            🔊 နားထောင်ပါ
          </button>
          <button className="btn secondary" type="button" onClick={() => speak(thai, 0.7)}>
            🐢 Slow
          </button>
          {withRecord && (
            <button
              className={`btn ghost ${isRecording ? 'recording' : ''}`}
              type="button"
              onClick={() => toggleRecord(recId)}
            >
              {isRecording ? '⏹️ Stop recording' : '🎙️ အသံသွင်းပါ'}
            </button>
          )}
        </div>
        {withRecord && recordedUrl && (
          <div style={{ marginTop: '12px' }}>
            <p className="muted" style={{ margin: '4px 0' }}>သင့်အသံကို ပြန်နားထောင်ပါ</p>
            <audio controls src={recordedUrl} style={{ width: '100%' }} />
          </div>
        )}
      </>
    );
  };

  const renderCard = (entry: VocabItem, moreContent?: React.ReactNode) => (
    <div className="card">
      <span className="tag">{entry.category}</span>
      <div className="thai" lang="th">{entry.thai}</div>
      <div className="phonetic">{entry.phonetic}</div>
      <div className="mm" lang="my">{entry.mm}</div>
      {moreContent}
    </div>
  );

  const renderTabBar = () => (
    <div className="controls" style={{ marginBottom: '14px' }}>
      {(['Words', 'Sentences', 'Q & A', 'Grammar'] as const).map(tab => (
        <button
          key={tab}
          type="button"
          className={`btn ${learnTab === tab ? '' : 'secondary'}`}
          onClick={() => {
            setLearnTab(tab);
            setLearnIndex(0);
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  // ---------------- HOME VIEW ----------------
  const renderHome = () => (
    <>
      <div className="section-head">
        <h2>စတင်လေ့လာပါ 🌼</h2>
        <span className="muted">အခန်း ၁</span>
      </div>

      <div className="notice">
        အသံကို နားထောင်ပါ → လိုက်ပြောပါ → စာကြောင်းကို လေ့ကျင့်ပါ။ ထိုင်းအက္ခရာ အရင်ကျက်ရန် မလိုပါ။
      </div>

      <div className="rows" style={{ marginTop: '14px' }}>
        <button
          className="tile"
          type="button"
          onClick={() => {
            setLearnTab('Words');
            setLearnIndex(0);
            navigateTo('learn');
          }}
        >
          <span className="emoji">📖</span>
          <strong>စကားလုံးများ</strong>
          <small>Vocabulary · {words.length} items</small>
        </button>

        <button
          className="tile"
          type="button"
          onClick={() => {
            setLearnTab('Sentences');
            setLearnIndex(0);
            navigateTo('learn');
          }}
        >
          <span className="emoji">🎧</span>
          <strong>ဝါကျများ</strong>
          <small>Listen & repeat · {sentences.length}</small>
        </button>

        <button
          className="tile"
          type="button"
          onClick={() => {
            setLearnTab('Grammar');
            navigateTo('learn');
          }}
        >
          <span className="emoji">🧩</span>
          <strong>သဒ္ဒါ</strong>
          <small>Tap to see examples</small>
        </button>

        <button
          className="tile"
          type="button"
          onClick={() => {
            setLearnTab('Q & A');
            navigateTo('learn');
          }}
        >
          <span className="emoji">💬</span>
          <strong>အမေး / အဖြေ</strong>
          <small>10 listen & repeat pairs</small>
        </button>

        <button
          className="tile"
          type="button"
          onClick={() => {
            setPractice('quiz');
            navigateTo('practice');
          }}
        >
          <span className="emoji">📝</span>
          <strong>Unit 1 Quiz</strong>
          <small>12 comprehension questions</small>
        </button>
      </div>

      <h3 style={{ marginTop: '24px' }}>ဒီနေ့ လေ့လာမယ့် ဝါကျ</h3>
      {renderCard(sentences[0], renderActions(sentences[0], false))}

      <button
        className="btn wide"
        type="button"
        style={{ marginTop: '8px' }}
        onClick={() => {
          setLearnTab('Words');
          navigateTo('learn');
        }}
      >
        သင်ခန်းစာ စတင်ရန် →
      </button>
    </>
  );

  // ---------------- LEARN VIEW ----------------
  const renderLearn = () => {
    if (learnTab === 'Q & A') {
      const q = qaLessons[qaIndex];
      const qPhon = schoolPhonetics[q[0]] || '';
      const aPhon = schoolPhonetics[q[1]] || '';

      return (
        <>
          <div className="section-head">
            <h2>မေးခွန်းနှင့် အဖြေ · Q & A</h2>
            <span className="counter">{qaIndex + 1} / {qaLessons.length}</span>
          </div>

          {renderTabBar()}

          <p className="section-intro">
            မေးခွန်းနှင့် အဖြေကို တစ်ကြောင်းချင်း နားထောင်၍ လိုက်ပြောပါ။ ဖြေရန် မလိုပါ။
          </p>

          <div className="card">
            <div className="qa-item">
              <span className="tag">Q · မေးခွန်း</span>
              <div className="thai" lang="th">{q[0]}</div>
              <div className="phonetic">{qPhon}</div>
              <div className="mm" lang="my">{q[2]}</div>
              {renderActions([q[0], qPhon, q[2]], true, 'qa-q-' + qaIndex)}
            </div>

            <div className="qa-divider">↓ Answer · အဖြေ</div>

            <div className="qa-item">
              <span className="tag">A · အဖြေ</span>
              <div className="thai" lang="th">{q[1]}</div>
              <div className="phonetic">{aPhon}</div>
              <div className="mm" lang="my">{q[3]}</div>
              {renderActions([q[1], aPhon, q[3]], true, 'qa-a-' + qaIndex)}
            </div>
          </div>

          <div className="controls">
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                mark(`learn-qa-${qaIndex}`);
                setQaIndex((qaIndex - 1 + qaLessons.length) % qaLessons.length);
              }}
            >
              ← အရင်တစ်ခု
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                mark(`learn-qa-${qaIndex}`);
                setQaIndex((qaIndex + 1) % qaLessons.length);
              }}
            >
              နောက်တစ်ခု →
            </button>
          </div>

          {statusMessage && <p className="footnote">{statusMessage}</p>}
        </>
      );
    }

    if (learnTab === 'Grammar') {
      return (
        <>
          <div className="section-head">
            <h2>သဒ္ဒါ · Grammar</h2>
          </div>

          {renderTabBar()}

          <p className="section-intro">
            ခေါင်းစဉ်တစ်ခုကို နှိပ်ပြီး ဝါကျနမူနာများ ကြည့်ပါ။ • Tap a grammar title to see examples.
          </p>

          {grammarGroups.map((g, j) => {
            const examples = sentences.filter(s => s.category === g.type).slice(0, 7);
            return (
              <details key={j} className="grammar-accordion" open={j === 0 ? true : undefined}>
                <summary>{j + 1}. {g.title}</summary>
                <div className="grammar-body">
                  <h3 style={{ marginTop: '15px' }}>{g.structure}</h3>
                  <p className="muted">{g.note}</p>
                  {examples.map((ex, exIndex) => (
                    <div key={exIndex} style={{ padding: '15px 0', borderTop: '1px solid #efe7f1' }}>
                      <div className="thai" style={{ fontSize: '23px' }} lang="th">{ex.thai}</div>
                      <div className="phonetic">{ex.phonetic}</div>
                      <div className="mm" lang="my">{ex.mm}</div>
                      {renderActions(ex, false)}
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </>
      );
    }

    // Tab is 'Words' or 'Sentences'
    const items = learnTab === 'Words' ? words : sentences;
    const currentItem = items[learnIndex] || items[0];

    return (
      <>
        <div className="section-head">
          <h2>နားထောင်ပြီး လိုက်ပြောပါ</h2>
          <span className="counter">{learnIndex + 1} / {items.length}</span>
        </div>

        {renderTabBar()}

        {renderCard(
          currentItem,
          renderActions(currentItem, true, `${learnTab.toLowerCase()}-${learnIndex}`)
        )}

        <div className="controls">
          <button
            className="btn secondary"
            type="button"
            onClick={() => {
              mark(`learn-${learnTab}-${learnIndex}`);
              setLearnIndex((learnIndex - 1 + items.length) % items.length);
            }}
          >
            ← ရှေ့သို့
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              mark(`learn-${learnTab}-${learnIndex}`);
              setLearnIndex((learnIndex + 1) % items.length);
            }}
          >
            သိပြီ · Next →
          </button>
        </div>

        {statusMessage && <p className="footnote">{statusMessage}</p>}
      </>
    );
  };

  // ---------------- PRACTICE VIEW ----------------
  const renderQuiz = () => {
    if (quizIndex >= quizQuestions.length) {
      const total = quizQuestions.length;
      const pct = Math.round((quizScore / total) * 100);
      const missed = quizResponses.filter(r => !r.correct);

      return (
        <div className="card quiz-finish">
          <div className="bigscore">{pct}%</div>
          <h2>Unit 1 Quiz ပြီးပါပြီ!</h2>
          <p className="mm">{quizScore} / {total} မှန်ပါတယ်။</p>
          <p className="muted">မှားခဲ့သော မေးခွန်းများကို ပြန်ကြည့်ပြီး နောက်တစ်ကြိမ် စမ်းကြည့်နိုင်ပါတယ်။</p>

          {missed.map((m, idx) => {
            const q = quizQuestions[m.index];
            return (
              <div key={idx} className="quiz-review">
                <strong>{q.q}</strong>
                <p className="muted">{q.why}</p>
              </div>
            );
          })}

          <button
            className="btn wide"
            type="button"
            style={{ marginTop: '16px' }}
            onClick={() => {
              setQuizIndex(0);
              setQuizResponses([]);
              setQuizScore(0);
            }}
          >
            🔄 Quiz ပြန်ဖြေရန်
          </button>
        </div>
      );
    }

    const q = quizQuestions[quizIndex];
    const pickedResponse = quizResponses.find(r => r.index === quizIndex);

    const handleChoice = (cIdx: number) => {
      if (pickedResponse) return;
      const correct = cIdx === q.correct;
      setQuizResponses(prev => [...prev, { index: quizIndex, choice: cIdx, correct }]);
      if (correct) {
        setQuizScore(s => s + 1);
      }
    };

    const nextQuizItem = () => {
      const nextIdx = quizIndex + 1;
      setQuizIndex(nextIdx);
      if (nextIdx >= quizQuestions.length) {
        mark('unit1-quiz-completed');
      }
    };

    return (
      <div className="card">
        <span className="tag">Unit 1 Quiz · {quizIndex + 1} / {quizQuestions.length}</span>
        <div className="quiz-progress">
          <span style={{ width: `${(100 * quizIndex) / quizQuestions.length}%` }}></span>
        </div>

        <h3 className="quiz-question">{q.q}</h3>

        {q.audio && (
          <div className="controls" style={{ marginBottom: '14px' }}>
            <button className="btn" type="button" onClick={() => speak(q.audio!)}>
              🔊 အသံနားထောင်ပါ
            </button>
            <button className="btn secondary" type="button" onClick={() => speak(q.audio!, 0.7)}>
              🐢 Slow
            </button>
          </div>
        )}

        <div className="stack" style={{ marginTop: '17px' }}>
          {q.choices.map((opt, j) => {
            let statusClass = '';
            if (pickedResponse) {
              if (j === q.correct) statusClass = 'correct';
              else if (j === pickedResponse.choice) statusClass = 'incorrect';
            }
            return (
              <button
                key={j}
                type="button"
                className={`quiz-option ${statusClass}`}
                disabled={!!pickedResponse}
                onClick={() => handleChoice(j)}
              >
                {String.fromCharCode(65 + j)}. {opt}
              </button>
            );
          })}
        </div>

        {pickedResponse ? (
          <>
            <div className="quiz-feedback">
              {pickedResponse.correct ? '✅ မှန်ပါတယ်!' : '❌ လေ့လာပြီး ထပ်စမ်းကြည့်ပါ။'}
              <p>{q.why}</p>
            </div>
            <button className="btn wide" type="button" onClick={nextQuizItem}>
              {quizIndex === quizQuestions.length - 1 ? 'ရလဒ် ကြည့်ရန် →' : 'နောက်မေးခွန်း →'}
            </button>
          </>
        ) : (
          <p className="muted" style={{ marginTop: '12px' }}>အဖြေတစ်ခုကို ရွေးပါ။</p>
        )}
      </div>
    );
  };

  const renderBlank = () => {
    const q = blanks[blankIndex % blanks.length];

    const checkAnswer = () => {
      const cleaned = blankInput.trim().replace(/\s/g, '');
      const isOk = cleaned === q.answer;
      setBlankFeedback({ checked: true, ok: isOk });
      if (isOk) {
        mark(`blank-${blankIndex}`);
      }
    };

    const nextBlank = () => {
      setBlankIndex(prev => (prev + 1) % blanks.length);
      setBlankInput('');
      setBlankFeedback(null);
    };

    return (
      <div className="card">
        <span className="tag">Listen & Fill · {(blankIndex % blanks.length) + 1} / {blanks.length}</span>
        <p className="muted">အသံနားထောင်ပြီး ပျောက်နေသော စကားလုံးကို ဖြည့်ပါ။</p>

        <button className="btn" type="button" onClick={() => speak(q.full)}>
          🔊 Listen
        </button>

        <div className="thai" style={{ fontSize: '25px', margin: '22px 0' }} lang="th">
          {q.blank}
        </div>

        <input
          type="text"
          lang="th"
          autoComplete="off"
          placeholder="พิมพ์คำที่หายไป"
          aria-label="Missing Thai word"
          value={blankInput}
          onChange={e => setBlankInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') checkAnswer();
          }}
        />

        <button
          className="btn wide"
          type="button"
          style={{ marginTop: '14px' }}
          onClick={checkAnswer}
        >
          စစ်ဆေးပါ
        </button>

        {blankFeedback && (
          <div className="answer">
            {blankFeedback.ok ? '✅ မှန်ပါတယ်!' : '❌ ထပ်ကြိုးစားပါ။'}
            {blankFeedback.ok && (
              <div style={{ marginTop: '8px' }}>
                <div className="thai" lang="th">{q.full}</div>
                <div className="phonetic">{schoolPhonetics[q.full] || ''}</div>
                <div className="mm" lang="my">{q.mm}</div>
              </div>
            )}
          </div>
        )}

        {blankFeedback?.ok && (
          <button
            className="btn"
            type="button"
            style={{ marginTop: '14px' }}
            onClick={nextBlank}
          >
            Next →
          </button>
        )}
      </div>
    );
  };

  const renderRearrange = () => {
    const lesson = rearrangeLessons[reorderIndex];
    const n = lesson.parts.length;
    // Bank order is stable reverse of parts
    const bankOrder = Array.from({ length: n }, (_, i) => n - 1 - i);
    const available = bankOrder.filter(id => !reorderPicked.includes(id));
    const complete = reorderPicked.length === n;
    const isCorrect = reorderChecked && complete && reorderPicked.every((id, j) => id === j);

    const pick = (id: number) => {
      if (reorderPicked.includes(id) || reorderPicked.length >= n) return;
      setReorderPicked(prev => [...prev, id]);
      setReorderChecked(false);
    };

    const remove = (id: number) => {
      setReorderPicked(prev => prev.filter(x => x !== id));
      setReorderChecked(false);
    };

    const check = () => {
      if (reorderPicked.length !== n) return;
      setReorderChecked(true);
      if (reorderPicked.every((id, j) => id === j)) {
        mark(`rearrange-${reorderIndex}`);
      }
    };

    const reset = () => {
      setReorderPicked([]);
      setReorderChecked(false);
    };

    const next = () => {
      setReorderIndex((reorderIndex + 1) % rearrangeLessons.length);
      reset();
    };

    const fullThai = lesson.parts.map(p => p[0]).join('');
    const fullPhon = '/' + lesson.parts.map(p => p[1].replaceAll('/', '')).join('-') + '/';

    return (
      <div className="card">
        <span className="tag">Rearrange Sentence · {reorderIndex + 1} / {rearrangeLessons.length}</span>

        <p className="section-intro">
          မြန်မာအဓိပ္ပာယ်ကို ဖတ်ပြီး ထိုင်းစကားလုံးများကို အစီအစဉ်မှန် စီပါ။ ကတ်တစ်ခုစီတွင် ထိုင်းစာ၊ စာအုပ်သုံး phonetic နှင့် မြန်မာအသံထွက် ပါရှိသည်။
        </p>

        <div className="reorder-prompt">
          <strong>မြန်မာအဓိပ္ပာယ်</strong>
          <div className="mm" lang="my">{lesson.meaning}</div>
        </div>

        <div className="controls">
          <button className="btn secondary" type="button" onClick={() => speak(fullThai)}>
            🔊 နားထောင်ပါ
          </button>
          <button className="btn ghost" type="button" onClick={() => speak(fullThai, 0.7)}>
            🐢 အနှေးအသံ
          </button>
        </div>

        <div className="reorder-area">
          <h4>၁။ စီထားသော စကားလုံးများ (နှိပ်၍ ပြန်ဖြုတ်နိုင်ပါသည်)</h4>
          <div className="reorder-tiles">
            {reorderPicked.length > 0 ? (
              reorderPicked.map(id => {
                const part = lesson.parts[id];
                return (
                  <button
                    key={id}
                    type="button"
                    className="reorder-token selected"
                    onClick={() => remove(id)}
                    aria-label={`Remove ${part[0]}`}
                  >
                    <span className="reorder-thai" lang="th">{part[0]}</span>
                    <span className="reorder-phon">{part[1]}</span>
                    <span className="reorder-my" lang="my">{part[2]}</span>
                  </button>
                );
              })
            ) : (
              <div className="reorder-empty">အောက်က ကတ်များကို အစဉ်လိုက် နှိပ်ပါ။</div>
            )}
          </div>
        </div>

        <div className="reorder-bank">
          <h4>၂။ စကားလုံးကတ်များ</h4>
          <div className="reorder-tiles">
            {available.length > 0 ? (
              available.map(id => {
                const part = lesson.parts[id];
                return (
                  <button
                    key={id}
                    type="button"
                    className="reorder-token"
                    onClick={() => pick(id)}
                    aria-label={`Choose ${part[0]}`}
                  >
                    <span className="reorder-thai" lang="th">{part[0]}</span>
                    <span className="reorder-phon">{part[1]}</span>
                    <span className="reorder-my" lang="my">{part[2]}</span>
                  </button>
                );
              })
            ) : (
              <span className="muted">စကားလုံးအားလုံး စီပြီးပါပြီ။</span>
            )}
          </div>
        </div>

        {reorderChecked && (
          isCorrect ? (
            <>
              <div className="reorder-status good" role="status">
                <strong>✅ မှန်ပါတယ်!</strong> စာကြောင်းကို မှန်ကန်စွာ စီထားပါတယ်။
              </div>
              <div className="reorder-complete">
                <div className="thai" lang="th">{fullThai}</div>
                <div className="phonetic">{fullPhon}</div>
                <div className="mm" lang="my">{lesson.meaning}</div>
              </div>
            </>
          ) : (
            <div className="reorder-status try" role="status">
              အစီအစဉ် မမှန်သေးပါ။ စကားလုံးကို နှိပ်ပြီး ပြန်ရွှေ့နိုင်ပါတယ်။
            </div>
          )
        )}

        <div className="reorder-controls">
          <button className="btn secondary" type="button" onClick={reset}>
            ↺ ပြန်စီရန်
          </button>
          {isCorrect ? (
            <button className="btn" type="button" onClick={next}>
              {reorderIndex === rearrangeLessons.length - 1 ? 'နောက်တစ်ကြိမ် လေ့ကျင့်ရန်' : 'နောက်ဝါကျ →'}
            </button>
          ) : (
            <button
              className="btn"
              type="button"
              disabled={!complete}
              onClick={check}
            >
              ✓ အဖြေစစ်ရန်
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderPractice = () => (
    <>
      <div className="section-head">
        <h2>Practice · လေ့ကျင့်ခန်း</h2>
      </div>

      <div className="rows practice-tiles">
        <button
          className="tile"
          type="button"
          onClick={() => {
            setPractice('quiz');
            setQuizIndex(0);
            setQuizResponses([]);
            setQuizScore(0);
          }}
        >
          📝 <strong>Unit 1 Quiz</strong>
          <small>သင်ယူထားသည်ကို စမ်းစစ်ပါ</small>
        </button>

        <button
          className="tile"
          type="button"
          onClick={() => {
            setPractice('blank');
            setBlankIndex(0);
            setBlankInput('');
            setBlankFeedback(null);
          }}
        >
          🎧 <strong>Listen & Fill</strong>
          <small>နားထောင်ပြီး ဖြည့်ပါ</small>
        </button>

        <button
          className="tile"
          type="button"
          onClick={() => {
            setPractice('rearrange');
            setReorderIndex(0);
            setReorderPicked([]);
            setReorderChecked(false);
          }}
        >
          🧩 <strong>Rearrange Sentence</strong>
          <small>စကားလုံးများကို အစီအစဉ်မှန် စီပါ</small>
        </button>
      </div>

      <div id="exercise" style={{ marginTop: '14px' }}>
        {practice === 'quiz' && renderQuiz()}
        {practice === 'blank' && renderBlank()}
        {practice === 'rearrange' && renderRearrange()}
      </div>
    </>
  );

  // ---------------- FLASHCARDS VIEW ----------------
  const renderFlash = () => {
    const w = words[flashIndex];

    const flipCard = () => {
      setFlashBack(prev => !prev);
      mark(`card-${flashIndex}`);
    };

    const stepFlash = (delta: number) => {
      setFlashIndex((flashIndex + delta + words.length) % words.length);
      setFlashBack(false);
    };

    return (
      <>
        <div className="section-head">
          <h2>Flashcards · မှတ်ဉာဏ်လေ့ကျင့်</h2>
          <span className="counter">{flashIndex + 1} / {words.length}</span>
        </div>

        <div
          className="card"
          style={{
            textAlign: 'center',
            minHeight: '310px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          onClick={flipCard}
        >
          <span className="tag">{flashBack ? 'Meaning' : 'Thai word'}</span>
          {flashBack ? (
            <div className="mm" style={{ fontSize: '26px' }} lang="my">
              {w.mm}
            </div>
          ) : (
            <>
              <div className="thai" lang="th">{w.thai}</div>
              <div className="phonetic">{w.phonetic}</div>
            </>
          )}
          <p className="muted" style={{ marginTop: '16px' }}>ကတ်ကိုနှိပ်ပြီး လှန်ကြည့်ပါ</p>
        </div>

        <div className="controls">
          <button className="btn secondary" type="button" onClick={() => speak(w.thai)}>
            🔊 နားထောင်ပါ
          </button>
          <button className="btn ghost" type="button" onClick={() => stepFlash(-1)}>
            ← ရှေ့သို့
          </button>
          <button className="btn" type="button" onClick={() => stepFlash(1)}>
            နောက်တစ်ခု →
          </button>
        </div>
      </>
    );
  };

  // ---------------- SETTINGS VIEW ----------------
  const renderSettings = () => (
    <>
      <h2>⚙️ အသံနှင့် app settings</h2>

      <div className="card">
        <h3>Thai voice · အသံ</h3>
        <p className="muted">Thai voice selection depends on the browser and operating system.</p>

        <div className="notice" style={{ margin: '10px 0' }}>
          {detectedVoice}
        </div>

        <label htmlFor="rate" style={{ display: 'block', marginTop: '12px' }}>
          Audio speed · <span>{speed}</span>×
        </label>
        <input
          id="rate"
          type="range"
          min="0.5"
          max="1.1"
          step="0.05"
          value={speed}
          style={{ width: '100%', margin: '10px 0' }}
          onChange={e => {
            const val = parseFloat(e.target.value);
            setSpeed(val);
            localStorage.setItem('thaiSpeed', String(val));
          }}
        />

        <div className="controls">
          <button className="btn" type="button" onClick={() => speak('สวัสดีครับ')}>
            🔊 Test Thai voice
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Install on phone</h3>
        <p className="muted">
          Open the hosted site in Chrome on Android or Safari on iPhone, then use Add to Home Screen / Install App.
        </p>
        <p className="small">
          A PWA needs HTTPS or localhost. The current downloaded HTML file can be opened as a preview, but installation and offline caching require hosting.
        </p>
      </div>

      <div className="card">
        <h3>Student progress</h3>
        <p className="muted">Saved on this device, not synchronized with a school account.</p>
        <button
          className="btn secondary"
          type="button"
          onClick={() => {
            if (window.confirm('Reset your progress?')) {
              setDone([]);
              localStorage.removeItem('thaiDone');
            }
          }}
        >
          Reset progress
        </button>
      </div>
    </>
  );

  return (
    <div className="app">
      {/* Hero Header */}
      <header className="hero">
        <div className="top">
          <div className="brandwrap">
            <img
              className="school-logo"
              src="/school-logo.svg"
              alt="ThaiSar school logo"
              onError={(e) => {
                // Fallback to inline SVG if needed
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <div className="brand-title">THAISAR</div>
              <div className="logo-label">Thai · Myanmar Speaking School</div>
            </div>
          </div>
          <div className="pill">🇹🇭 + 🇲🇲</div>
        </div>

        <h1>အခန်း (၁) · မိတ်ဆက်ခြင်း</h1>
        <p>Unit 1 · Listening & Speaking · Beginner</p>

        <div className="progress">
          <span style={{ width: `${progressPercent}%` }}></span>
        </div>
        <div className="small" style={{ marginTop: '7px', color: '#e2f9f0' }}>
          သင်ယူမှု တိုးတက်မှု · {progressPercent}% ({done.length} activities)
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main" className="content">
        {page === 'home' && renderHome()}
        {page === 'learn' && renderLearn()}
        {page === 'practice' && renderPractice()}
        {page === 'flash' && renderFlash()}
        {page === 'settings' && renderSettings()}
      </main>

      {/* Bottom Mobile Navigation */}
      <nav className="nav" id="nav">
        <button
          type="button"
          className={page === 'home' ? 'active' : ''}
          onClick={() => navigateTo('home')}
        >
          <span className="ico">⌂</span>
          ပင်မ
        </button>

        <button
          type="button"
          className={page === 'learn' ? 'active' : ''}
          onClick={() => navigateTo('learn')}
        >
          <span className="ico">◉</span>
          လေ့လာ
        </button>

        <button
          type="button"
          className={page === 'practice' ? 'active' : ''}
          onClick={() => navigateTo('practice')}
        >
          <span className="ico">✦</span>
          လေ့ကျင့်
        </button>

        <button
          type="button"
          className={page === 'flash' ? 'active' : ''}
          onClick={() => navigateTo('flash')}
        >
          <span className="ico">▣</span>
          ကတ်များ
        </button>

        <button
          type="button"
          className={page === 'settings' ? 'active' : ''}
          onClick={() => navigateTo('settings')}
        >
          <span className="ico">⚙</span>
          ချိန်ညှိ
        </button>
      </nav>
    </div>
  );
}
