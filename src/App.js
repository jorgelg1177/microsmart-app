import React, { useState, useRef, useEffect } from "react";
import {
  Home,
  Clock,
  Bot,
  Settings,
  Power,
  Bell,
  ShieldCheck,
  User,
  MapPin,
  Package,
  ShieldAlert,
  ChevronRight,
  Wifi,
  Send,
  Sparkles,
  X,
  UserPlus,
  MessageSquare,
  PhoneForwarded,
  Menu,
  LogOut,
  Mic,
  MicOff,
  Volume2,
  Wand2,
  FileText,
  CheckCircle2,
  Lock,
  Smartphone,
  Bluetooth,
  Mail,
  Key,
} from "lucide-react";

import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { getDatabase, ref, set, push, onValue } from "firebase/database";

// =========================================================================
// ⚠️ TUS CLAVES REALES DE FIREBASE
const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUÍ",
  authDomain: "tu-proyecto.firebaseapp.com",
  databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
// =========================================================================

const fetchWithRetry = async (url, options, retries = 2, delay = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      if (res.status === 401) throw new Error("Error 401: Clave inválida.");
      if (res.status === 404)
        throw new Error("Error 404: Modelo no encontrado.");
      if (res.status === 400 || res.status === 403 || res.status === 429)
        throw new Error(`Error de Google (${res.status})`);
      throw new Error(`Error HTTP: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    if (
      retries > 0 &&
      !error.message.includes("Error 401") &&
      !error.message.includes("Error 404")
    ) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
};

const MicroSmartLogo = ({ className }) => (
  <div className={className}>
    <img
      src="/logo.png"
      alt="MicroSmart"
      className="h-full w-auto object-contain"
      onError={(e) => {
        e.target.style.display = "none";
        e.target.nextSibling.style.display = "block";
      }}
    />
    <span className="hidden font-black text-xl tracking-tighter text-slate-800 uppercase">
      MICRO<span className="text-[#7bc100]">SMART</span>
    </span>
  </div>
);

const getCurrentTime = () =>
  new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("home");
  const [doorStatus, setDoorStatus] = useState("idle");
  const [isPairing, setIsPairing] = useState(false);
  const [pairedDevices, setPairedDevices] = useState([]);
  const [authorizedNames, setAuthorizedNames] = useState([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [historyLog, setHistoryLog] = useState([]);
  const [messagesList, setMessagesList] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // --- NUEVOS ESTADOS PARA EL MODAL BLUETOOTH ---
  const [wifiModalOpen, setWifiModalOpen] = useState(false);
  const [tempSsid, setTempSsid] = useState("");
  const [tempPass, setTempPass] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [isFluidMode, setIsFluidMode] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activitySummary, setActivitySummary] = useState("");
  const [draftingId, setDraftingId] = useState(null);

  const isFluidModeRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const apiHistoryRef = useRef([]);
  const authorizedNamesRef = useRef(authorizedNames);
  const chatEndRef = useRef(null);

  const [chatHistory, setChatHistory] = useState([
    {
      role: "ai",
      content:
        "Hola, soy el conserje inteligente de MicroSmart. ¿En qué le puedo ayudar?",
    },
  ]);
  const [apiHistory, setApiHistory] = useState([]);

  const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
  const aiModel = "gemini-2.5-flash";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setHistoryLog([]);
        setPairedDevices([]);
        setAuthorizedNames([]);
        setMessagesList([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      const uid = currentUser.uid;
      onValue(ref(db, `users/${uid}/devices`), (s) =>
        setPairedDevices(s.val() ? Object.values(s.val()) : [])
      );
      onValue(ref(db, `users/${uid}/authorizedNames`), (s) =>
        setAuthorizedNames(s.val() ? Object.values(s.val()) : [])
      );
      onValue(ref(db, `users/${uid}/history`), (s) => {
        const d = s.val();
        setHistoryLog(
          d
            ? Object.keys(d)
                .map((k) => ({ ...d[k], dbKey: k }))
                .sort((a, b) => b.id - a.id)
            : []
        );
      });
      onValue(ref(db, `users/${uid}/messages`), (s) => {
        const d = s.val();
        setMessagesList(
          d
            ? Object.keys(d)
                .map((k) => ({ ...d[k], dbKey: k }))
                .sort((a, b) => b.id - a.id)
            : []
        );
      });
    }
  }, [currentUser]);

  useEffect(() => {
    authorizedNamesRef.current = authorizedNames;
  }, [authorizedNames]);
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () =>
        window.speechSynthesis.getVoices();
    }
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setAuthLoading(true);
    try {
      if (authMode === "login")
        await signInWithEmailAndPassword(auth, email, password);
      else if (authMode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
        setAuthMessage("Cuenta creada.");
      } else if (authMode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setAuthMessage("Revisa tu correo.");
      }
    } catch (error) {
      setAuthError("Error: " + error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const saveToHistory = async (newLog) => {
    if (currentUser)
      await push(ref(db, `users/${currentUser.uid}/history`), newLog);
  };
  const saveMessage = async (newMsg) => {
    if (currentUser)
      await push(ref(db, `users/${currentUser.uid}/messages`), newMsg);
  };

  // --- LA MAGIA DEL BLUETOOTH WEB ---
  const ejecutarEmparejamientoBLE = async () => {
    if (!currentUser) return;
    setIsPairing(true);

    try {
      // 1. Buscamos el ESP32
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "MicroSmart_ESP32" }],
        optionalServices: ["19b10000-e8f2-537e-4f6c-d104768a1214"],
      });

      // 2. Nos conectamos a su "Servicio"
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(
        "19b10000-e8f2-537e-4f6c-d104768a1214"
      );
      const characteristic = await service.getCharacteristic(
        "19b10001-e8f2-537e-4f6c-d104768a1214"
      );

      // 3. Juntamos el WiFi, la Clave y el UID invisible
      const payload = `${tempSsid}||${tempPass}||${currentUser.uid}`;
      const encoder = new TextEncoder();

      // 4. Se lo enviamos al ESP32
      await characteristic.writeValue(encoder.encode(payload));

      // 5. Lo guardamos en Firebase como vinculado
      const newDeviceName = "ESP32_Conserje_BLE";
      if (!pairedDevices.includes(newDeviceName)) {
        const updatedDevices = [...pairedDevices, newDeviceName];
        await set(ref(db, `users/${currentUser.uid}/devices`), updatedDevices);
      }

      alert(
        "¡Vinculado con éxito! El portero se está conectando al WiFi de tu casa."
      );
      setWifiModalOpen(false);
      setTempSsid("");
      setTempPass("");
    } catch (error) {
      console.error(error);
      alert(
        "Error de Bluetooth. Asegúrate de estar cerca y darle permisos al navegador."
      );
    } finally {
      setIsPairing(false);
    }
  };

  const handleAddName = async () => {
    if (newName.trim() && newPhone.trim() && currentUser) {
      const formattedPhone = newPhone.startsWith("+")
        ? newPhone.trim()
        : `+34 ${newPhone.trim()}`;
      await set(ref(db, `users/${currentUser.uid}/authorizedNames`), [
        ...authorizedNames,
        { name: newName.trim(), phone: formattedPhone },
      ]);
      setNewName("");
      setNewPhone("");
    }
  };

  const handleRemoveName = async (nameToRemove) => {
    if (currentUser)
      await set(
        ref(db, `users/${currentUser.uid}/authorizedNames`),
        authorizedNames.filter((p) => p.name !== nameToRemove)
      );
  };

  const handleOpenDoor = async () => {
    if (doorStatus !== "idle" || !currentUser) return;
    setDoorStatus("opening");
    try {
      await set(ref(db, "puerta"), "ABRIR");
      setDoorStatus("opened");
      saveToHistory({
        id: Date.now(),
        type: "manual",
        title: "Apertura Manual",
        desc: `Desde App por ${currentUser.email}`,
        time: getCurrentTime(),
        date: "Hoy",
      });
    } catch (error) {
      alert("Error de conexión.");
      setDoorStatus("idle");
    } finally {
      setTimeout(() => setDoorStatus("idle"), 2500);
    }
  };

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (isFluidModeRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        if (
          isFluidModeRef.current &&
          !isProcessingRef.current &&
          !isSpeakingRef.current
        ) {
          speakResponse("Parece que no hay nadie. Me retiro.", true);
          setChatHistory((prev) => [
            ...prev,
            {
              role: "ai",
              content: "Parece que no hay nadie. [Llamada finalizada]",
            },
          ]);
        }
      }, 15000);
    }
  };

  const stopFluidMode = () => {
    isFluidModeRef.current = false;
    setIsFluidMode(false);
    setIsListening(false);
    isProcessingRef.current = false;
    isSpeakingRef.current = false;
    if (recognitionRef.current) recognitionRef.current.stop();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  };

  const handleSummarizeActivity = async () => {
    /* IA Resumen intacta */
  };
  const handleDraftReply = async (message) => {
    /* IA Whatsapp intacta */
  };

  const speakResponse = (text, shouldEndCall = false) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/\[.*?\]/g, "").trim();
      if (!cleanText) {
        isProcessingRef.current = false;
        if (isFluidModeRef.current && !shouldEndCall) {
          setTimeout(() => {
            startListening();
            resetSilenceTimer();
          }, 300);
        } else if (shouldEndCall) {
          stopFluidMode();
        }
        return;
      }
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "es-ES";
      const voices = window.speechSynthesis.getVoices();
      let bestVoice = voices.find(
        (v) =>
          (v.lang.startsWith("es-") || v.lang === "es") &&
          (v.name.includes("Premium") || v.name.includes("Natural"))
      );
      if (!bestVoice)
        bestVoice = voices.find(
          (v) => v.lang.startsWith("es-") || v.lang === "es"
        );
      if (bestVoice) utterance.voice = bestVoice;
      isSpeakingRef.current = true;
      utterance.onend = () => {
        isSpeakingRef.current = false;
        if (shouldEndCall) {
          stopFluidMode();
        } else if (isFluidModeRef.current) {
          setTimeout(() => {
            startListening();
            resetSilenceTimer();
          }, 300);
        }
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = "es-ES";
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (
          isFluidModeRef.current &&
          !isProcessingRef.current &&
          !isSpeakingRef.current
        )
          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (e) {}
          }, 300);
      };
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          isProcessingRef.current = true;
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          recognitionRef.current.stop();
          handleSimulateVisitor(transcript);
        }
      };
      recognitionRef.current.onerror = () => setIsListening(false);
    }
    if (
      isFluidModeRef.current &&
      !isProcessingRef.current &&
      !isSpeakingRef.current
    )
      try {
        recognitionRef.current.start();
      } catch (e) {}
  };

  const toggleFluidMode = () => {
    if (isFluidModeRef.current) {
      stopFluidMode();
    } else {
      if ("speechSynthesis" in window)
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
      isFluidModeRef.current = true;
      setIsFluidMode(true);
      startListening();
      resetSilenceTimer();
    }
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    return () => {
      document.body.style.overflow = "auto";
      document.body.style.position = "static";
    };
  }, []);

  const handleSimulateVisitor = async (textOverride) => {
    const textToSend = textOverride || chatInput;
    if (!textToSend.trim() || isTyping) return;
    if (!apiKey) {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: "⚠️ Falla API." },
      ]);
      setIsTyping(false);
      isProcessingRef.current = false;
      return;
    }

    isProcessingRef.current = true;
    if (recognitionRef.current) recognitionRef.current.stop();
    setChatHistory((prev) => [...prev, { role: "user", content: textToSend }]);
    setChatInput("");
    setIsTyping(true);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`;
    const systemPrompt = `Eres el Conserje Inteligente de MicroSmart. REGLAS: 1. Privacidad. 2. Naturalidad. 3. Protocolo de salida con etiquetas: [ABRIR_PUERTA | Empresa | Destinatario], [MENSAJE_PARA | Desconocido | texto], [ACCESO_DENEGADO | Motivo], [FIN_CONVERSACION].`;

    let validApiHistory = [...apiHistoryRef.current];
    let combinedText = textToSend;
    if (
      validApiHistory.length > 0 &&
      validApiHistory[validApiHistory.length - 1].role === "user"
    ) {
      combinedText = validApiHistory.pop().parts[0].text + ". " + textToSend;
    }
    const contents = [
      ...validApiHistory,
      { role: "user", parts: [{ text: combinedText }] },
    ];

    try {
      const data = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: contents,
          generationConfig: { temperature: 0.65 },
        }),
      });
      let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      const updatedHistory = [
        ...contents,
        { role: "model", parts: [{ text: aiText }] },
      ];
      setApiHistory(updatedHistory);
      apiHistoryRef.current = updatedHistory;

      let actionType = null,
        endConversation = false;
      const finalAiText = aiText.replace(/\[.*?\]/g, "").trim();

      if (aiText.match(/\[ABRIR_PUERTA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/)) {
        actionType = "opened";
        if (currentUser)
          set(ref(db, "puerta"), "ABRIR").catch((e) => console.error(e));
        saveToHistory({
          id: Date.now(),
          type: "ai_open",
          title: `Acceso Concedido`,
          desc: `Autorizado por IA`,
          time: getCurrentTime(),
          date: "Hoy",
        });
      }

      const mensajeMatch = aiText.match(
        /\[MENSAJE_PARA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/
      );
      if (mensajeMatch) {
        actionType = "message_saved";
        saveMessage({
          id: Date.now(),
          recipient: mensajeMatch[1].trim(),
          content: mensajeMatch[2].trim(),
          time: getCurrentTime(),
          phone: "Desconocido",
        });
        saveToHistory({
          id: Date.now() + 1,
          type: "ai_message",
          title: `Recado guardado`,
          desc: `Para: ${mensajeMatch[1].trim()}`,
          time: getCurrentTime(),
          date: "Hoy",
        });
      }

      if (aiText.match(/\[ACCESO_DENEGADO\s*\|\s*(.*?)\]/)) {
        actionType = "denied";
        saveToHistory({
          id: Date.now(),
          type: "ai_denied",
          title: `Acceso Denegado`,
          desc: "Rechazado por IA",
          time: getCurrentTime(),
          date: "Hoy",
        });
      }
      if (aiText.includes("[FIN_CONVERSACION]")) endConversation = true;

      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: finalAiText, action: actionType },
      ]);
      isProcessingRef.current = false;
      speakResponse(finalAiText, endConversation);
    } catch (error) {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: `⚠️ Error de red.` },
      ]);
      isProcessingRef.current = false;
      if (isFluidModeRef.current)
        setTimeout(() => {
          startListening();
          resetSilenceTimer();
        }, 1500);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping]);

  if (!currentUser) {
    return (
      <div className="fixed inset-0 bg-[#f3f4f6] flex items-center justify-center font-sans p-4">
        <div className="w-full max-w-md bg-white rounded-[3rem] p-8 shadow-2xl flex flex-col items-center">
          <MicroSmartLogo className="h-32 mb-8 scale-110" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">
            {authMode === "login"
              ? "Bienvenido a casa"
              : authMode === "register"
              ? "Crear cuenta"
              : "Recuperar acceso"}
          </h2>
          <p className="text-slate-500 text-sm mb-6 text-center font-medium">
            Inicia sesión para gestionar tu hogar MicroSmart
          </p>

          {authError && (
            <div className="w-full bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold mb-4 text-center border border-red-100">
              {authError}
            </div>
          )}
          {authMessage && (
            <div className="w-full bg-green-50 text-green-700 p-3 rounded-xl text-xs font-bold mb-4 text-center border border-green-100">
              {authMessage}
            </div>
          )}

          <form onSubmit={handleAuth} className="w-full space-y-3">
            <div className="relative">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="email"
                placeholder="Correo electrónico"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-slate-800 font-medium"
              />
            </div>
            {authMode !== "reset" && (
              <div className="relative">
                <Key
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="password"
                  placeholder="Contraseña"
                  required
                  minLength="6"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-slate-800 font-medium"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-[#00479b] hover:bg-blue-800 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-blue-900/30 active:scale-95 transition-all mt-2 flex items-center justify-center"
            >
              {authLoading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : authMode === "login" ? (
                "ACCEDER AL SISTEMA"
              ) : authMode === "register" ? (
                "REGISTRARSE"
              ) : (
                "ENVIAR ENLACE"
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center space-y-3 w-full">
            {authMode === "login" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("reset");
                    setAuthError("");
                    setAuthMessage("");
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-[#00479b] transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
                <div className="flex-grow border-t border-slate-100 w-full my-2"></div>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError("");
                    setAuthMessage("");
                  }}
                  className="text-sm font-bold text-slate-600 hover:text-[#00479b] transition-colors"
                >
                  Crear una cuenta nueva
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                  setAuthMessage("");
                }}
                className="text-sm font-bold text-slate-600 hover:text-[#00479b] transition-colors"
              >
                ← Volver al inicio de sesión
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-[#f3f4f6] flex items-center justify-center font-sans text-slate-900 overflow-hidden">
      {/* MODAL WIFI BLUETOOTH INVISIBLE */}
      {wifiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-center mb-4 text-[#00479b]">
              <Bluetooth size={32} />
            </div>
            <h3 className="text-xl font-black text-center text-slate-800 mb-2">
              Conectar Portero
            </h3>
            <p className="text-xs text-center text-slate-500 mb-6">
              Ingresa los datos del WiFi de tu casa. Enviaremos esta
              configuración a tu portero de forma segura e invisible.
            </p>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nombre de tu WiFi"
                value={tempSsid}
                onChange={(e) => setTempSsid(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-sm font-medium"
              />
              <input
                type="password"
                placeholder="Contraseña del WiFi"
                value={tempPass}
                onChange={(e) => setTempPass(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-sm font-medium"
              />
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => setWifiModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarEmparejamientoBLE}
                disabled={isPairing || !tempSsid || !tempPass}
                className="flex-1 py-3 bg-[#00479b] text-white rounded-xl font-bold text-sm shadow-lg flex justify-center items-center"
              >
                {isPairing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  "Vincular"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md h-full md:h-[92vh] md:max-h-[850px] md:rounded-[3rem] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col relative md:border-[10px] border-[#1e293b]">
        <div className="bg-white px-6 pt-8 pb-3 flex flex-col z-10 border-b border-slate-50 shrink-0">
          <div className="flex justify-between items-center mb-3">
            <MicroSmartLogo className="h-[110px] w-auto flex items-center" />
            <div className="flex space-x-1">
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 rounded-full transition-colors"
              >
                <LogOut size={20} className="text-red-500" />
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-10 h-10 bg-[#00479b] rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/10 shrink-0">
              <User size={20} className="text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-base font-bold text-slate-800 leading-tight truncate">
                {currentUser.email}
              </h1>
              <p className="text-[10px] text-slate-500 font-medium flex items-center">
                <MapPin size={10} className="mr-1 text-[#7bc100]" />{" "}
                microsmart.es
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 px-6 pt-2 scrollbar-hide">
          {activeTab === "home" && (
            <div className="flex flex-col items-center space-y-8 py-8 animate-in fade-in zoom-in duration-500">
              <div
                className={`inline-flex items-center space-x-2 px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                  pairedDevices.length === 0
                    ? "bg-amber-50 text-amber-600"
                    : doorStatus === "idle"
                    ? "bg-green-50 text-green-600"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    pairedDevices.length === 0
                      ? "bg-amber-500"
                      : doorStatus === "idle"
                      ? "bg-green-500"
                      : "bg-blue-500 animate-pulse"
                  }`}
                ></div>
                <span>
                  {pairedDevices.length === 0
                    ? "SIN DISPOSITIVOS"
                    : "SISTEMA ONLINE"}
                </span>
              </div>
              <button
                onClick={handleOpenDoor}
                disabled={doorStatus !== "idle" || pairedDevices.length === 0}
                className={`relative w-56 h-56 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 ${
                  pairedDevices.length === 0
                    ? "bg-slate-200 text-slate-400 shadow-none"
                    : doorStatus === "idle"
                    ? "bg-gradient-to-tr from-[#6aa600] to-[#8be000] shadow-[#7bc100]/30"
                    : doorStatus === "opening"
                    ? "bg-[#00479b] shadow-blue-900/30"
                    : "bg-green-500 shadow-green-500/40 scale-105"
                }`}
              >
                {doorStatus === "idle" && (
                  <>
                    <Power
                      size={56}
                      className={`${
                        pairedDevices.length === 0
                          ? "text-slate-400"
                          : "text-white"
                      } mb-2`}
                    />
                    <span
                      className={`${
                        pairedDevices.length === 0
                          ? "text-slate-400"
                          : "text-white"
                      } text-xl font-black`}
                    >
                      ABRIR
                    </span>
                  </>
                )}
                {doorStatus === "opening" && (
                  <>
                    <ShieldCheck
                      size={56}
                      className="text-white mb-2 animate-bounce"
                    />
                    <span className="text-white text-lg font-bold">
                      PROCESANDO
                    </span>
                  </>
                )}
                {doorStatus === "opened" && (
                  <>
                    <CheckCircle2
                      size={56}
                      className="text-white mb-2 animate-in zoom-in"
                    />
                    <span className="text-white text-xl font-black">
                      ABIERTO
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500 bg-slate-50 -mx-6 rounded-t-[2.5rem] overflow-hidden border-t border-slate-200">
              <div className="p-5 pb-2 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <div>
                  <h2 className="text-lg font-black text-slate-800 flex items-center">
                    <Sparkles size={18} className="mr-2 text-[#00479b]" />{" "}
                    Conserje IA
                  </h2>
                  <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                    Conversación Fluida
                  </p>
                </div>
                <div
                  className={`px-2 py-1 ${
                    isFluidMode
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  } text-[8px] font-black rounded-full`}
                >
                  {isFluidMode ? "DESPIERTO" : "DORMIDO"}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-base leading-relaxed shadow-sm ${
                        msg.role === "user"
                          ? "bg-[#00479b] text-white rounded-br-none"
                          : "bg-white text-slate-700 rounded-bl-none border border-slate-100"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-100 px-4 py-2 rounded-2xl rounded-bl-none shadow-sm flex space-x-1">
                      <div className="w-1 h-1 bg-slate-300 rounded-full animate-bounce"></div>
                      <div
                        className="w-1 h-1 bg-slate-300 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-1 h-1 bg-slate-300 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 bg-white border-t border-slate-100">
                <div className="flex flex-col items-center space-y-4">
                  <button
                    onClick={toggleFluidMode}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-xl ${
                      isFluidMode
                        ? isListening
                          ? "bg-red-500 scale-110 animate-pulse ring-8 ring-red-100"
                          : "bg-amber-400 ring-8 ring-amber-50"
                        : "bg-slate-200"
                    }`}
                  >
                    {isFluidMode ? (
                      isListening ? (
                        <Mic size={32} className="text-white" />
                      ) : (
                        <Volume2 size={32} className="text-white" />
                      )
                    ) : (
                      <MicOff size={32} className="text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="py-4">
              {" "}
              <h2 className="text-xl font-black text-slate-800 tracking-tight mb-6">
                Registro
              </h2>{" "}
              <div className="space-y-3">
                {historyLog.map((log, i) => (
                  <div
                    key={i}
                    className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-3"
                  >
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800 text-xs mb-1">
                        {log.title}
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate">
                        {log.desc}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-black text-slate-700 block">
                        {log.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "messages" && (
            <div className="py-4">
              {" "}
              <h2 className="text-xl font-black text-slate-800 mb-6 tracking-tight">
                Recados
              </h2>{" "}
              <div className="space-y-4">
                {messagesList.map((msg, i) => (
                  <div
                    key={i}
                    className="bg-white p-5 rounded-3xl shadow-md border-l-4 border-l-[#7bc100]"
                  >
                    <h4 className="font-black text-slate-800 text-sm mb-2">
                      {msg.recipient}
                    </h4>
                    <p className="text-xs text-slate-600 mb-4 italic">
                      "{msg.content}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-5 py-4">
              <h2 className="text-xl font-black text-slate-800 mb-6 tracking-tight">
                Configuración
              </h2>

              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 shadow-lg">
                <div className="flex items-center space-x-3 text-white mb-4">
                  <Smartphone size={18} className="text-[#7bc100]" />
                  <h3 className="font-bold text-sm">Dispositivos MicroSmart</h3>
                </div>

                {pairedDevices.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {pairedDevices.map((dev, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl flex justify-between items-center"
                      >
                        <div>
                          <span className="text-white font-bold text-xs block">
                            {dev}
                          </span>
                          <span className="text-green-400 text-[9px] font-bold">
                            Conectado a la cuenta
                          </span>
                        </div>
                        <CheckCircle2 size={16} className="text-green-500" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-slate-800/50 rounded-xl mb-4 border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold">
                      No hay telefonillos vinculados
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setWifiModalOpen(true)}
                  className="w-full bg-[#00479b] hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl text-xs flex items-center justify-center transition-all shadow-xl active:scale-95"
                >
                  <Bluetooth size={16} className="mr-2" /> Emparejar por
                  Bluetooth
                </button>
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center space-x-3 mb-4">
                  <UserPlus size={18} className="text-[#00479b]" />
                  <h3 className="font-bold text-slate-800 text-sm">
                    Personas Autorizadas
                  </h3>
                </div>
                <div className="space-y-2 mb-4">
                  {authorizedNames.map((person, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100"
                    >
                      <div className="overflow-hidden">
                        <span className="text-xs font-bold text-slate-700 block truncate">
                          {person.name}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveName(person.name)}
                        className="text-red-400 p-2"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full bg-slate-50 border border-slate-200 text-base rounded-lg px-3 py-2.5 outline-none"
                  />
                  <div className="flex space-x-2">
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="Teléfono"
                      className="flex-1 bg-slate-50 border border-slate-200 text-base rounded-lg px-3 py-2.5 outline-none"
                    />
                    <button
                      onClick={handleAddName}
                      className="bg-[#00479b] text-white px-4 rounded-lg text-xs font-bold"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[92%] bg-white/95 backdrop-blur-xl border border-white/50 px-2 py-2 flex justify-between items-center z-20 rounded-[2rem] shadow-2xl">
          <NavItem
            active={activeTab === "home"}
            onClick={() => setActiveTab("home")}
            icon={<Home size={22} />}
            label="Inicio"
          />
          <NavItem
            active={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            icon={<Clock size={22} />}
            label="Registro"
          />
          <NavItem
            active={activeTab === "messages"}
            onClick={() => setActiveTab("messages")}
            icon={<MessageSquare size={22} />}
            badge={messagesList.length}
            label="Recados"
          />
          <NavItem
            active={activeTab === "ai"}
            onClick={() => setActiveTab("ai")}
            icon={<Bot size={22} />}
            label="IA"
          />
          <NavItem
            active={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
            icon={<Settings size={22} />}
            label="Ajustes"
          />
        </div>
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 flex flex-col items-center justify-center p-1.5 transition-all duration-300 ${
        active ? "text-[#00479b]" : "text-slate-400"
      }`}
    >
      <div
        className={`transition-all duration-300 ${
          active ? "scale-110 -translate-y-0.5" : "scale-100"
        }`}
      >
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[7px] font-black rounded-full flex items-center justify-center border-2 border-white">
            {badge}
          </span>
        )}
      </div>
      <span
        className={`text-[7px] font-black uppercase tracking-tighter mt-1 transition-all ${
          active ? "opacity-100" : "opacity-0 h-0"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
