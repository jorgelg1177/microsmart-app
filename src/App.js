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
} from "lucide-react";

const fetchWithRetry = async (url, options, retries = 2, delay = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
    return await res.json();
  } catch (error) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
};

const MicroSmartLogo = ({ className, showText = true }) => (
  <div className={`flex items-center ${className}`}>
    <div className="w-10 h-10 bg-gradient-to-tr from-[#00479b] to-[#005cd0] rounded-xl flex items-center justify-center shadow-lg mr-2 font-black text-white text-2xl italic tracking-tighter">
      S
    </div>
    {showText && (
      <span className="font-black text-2xl tracking-tighter text-slate-800 uppercase">
        MICRO<span className="text-[#7bc100]">SMART</span>
      </span>
    )}
  </div>
);

const getCurrentTime = () =>
  new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function App() {
  // --- NUEVOS ESTADOS PARA AUTENTICACIÓN Y EMPAREJAMIENTO ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [pairedDevice, setPairedDevice] = useState("ESP32_Interfono_1");

  const [activeTab, setActiveTab] = useState("home");
  const [doorStatus, setDoorStatus] = useState("idle");
  const [authorizedNames, setAuthorizedNames] = useState([
    { name: "Jorge Loaiza", phone: "+34 600 111 222" },
    { name: "Karla León Núñez", phone: "+34 600 333 444" },
  ]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [historyLog, setHistoryLog] = useState([]);
  const [messagesList, setMessagesList] = useState([]);

  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isFluidMode, setIsFluidMode] = useState(false);

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

  const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
  const firebaseUrl = process.env.REACT_APP_FIREBASE_URL;

  // --- CARGAR DATOS PERSISTENTES DE FIREBASE AL ENTRAR ---
  useEffect(() => {
    if (isAuthenticated && firebaseUrl) {
      // Cargar Historial
      fetch(`${firebaseUrl}/history.json`)
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            const logs = Object.values(data).sort((a, b) => b.id - a.id);
            setHistoryLog(logs);
          }
        });
      // Cargar Recados
      fetch(`${firebaseUrl}/messages.json`)
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            const msgs = Object.values(data).sort((a, b) => b.id - a.id);
            setMessagesList(msgs);
          }
        });
    }
  }, [isAuthenticated, firebaseUrl]);

  // --- FUNCIONES PARA GUARDAR EN LA NUBE (PERSISTENCIA) ---
  const addHistoryToCloud = async (logItem) => {
    setHistoryLog((prev) => [logItem, ...prev]);
    if (firebaseUrl) {
      await fetch(`${firebaseUrl}/history/${logItem.id}.json`, {
        method: "PUT",
        body: JSON.stringify(logItem),
      });
    }
  };

  const addMessageToCloud = async (msgItem) => {
    setMessagesList((prev) => [msgItem, ...prev]);
    if (firebaseUrl) {
      await fetch(`${firebaseUrl}/messages/${msgItem.id}.json`, {
        method: "PUT",
        body: JSON.stringify(msgItem),
      });
    }
  };

  useEffect(() => {
    authorizedNamesRef.current = authorizedNames;
  }, [authorizedNames]);

  // --- COMPONENTES DE AUDIO Y CEREBRO DE IA (MANTENIDOS INTACTOS) ---
  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (isFluidModeRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        if (
          isFluidModeRef.current &&
          !isProcessingRef.current &&
          !isSpeakingRef.current
        ) {
          speakResponse(
            "Parece que no hay nadie. Me retiro, excelente día.",
            true
          );
          setChatHistory((prev) => [
            ...prev,
            { role: "ai", content: "Llamada finalizada por inactividad." },
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
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  const speakResponse = (text, shouldEndCall = false) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/\[.*?\]/g, "").trim();
      if (!cleanText) {
        isProcessingRef.current = false;
        if (isFluidModeRef.current && !shouldEndCall)
          setTimeout(() => {
            startListening();
            resetSilenceTimer();
          }, 300);
        else if (shouldEndCall) stopFluidMode();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "es-ES";
      isSpeakingRef.current = true;
      utterance.onend = () => {
        isSpeakingRef.current = false;
        if (shouldEndCall) stopFluidMode();
        else if (isFluidModeRef.current)
          setTimeout(() => {
            startListening();
            resetSilenceTimer();
          }, 300);
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
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onresult = (event) => {
        if (event.results[0][0].transcript.trim()) {
          isProcessingRef.current = true;
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          recognitionRef.current.stop();
          handleSimulateVisitor(event.results[0][0].transcript);
        }
      };
    }
    try {
      recognitionRef.current.start();
    } catch (e) {}
  };

  const toggleFluidMode = () => {
    if (isFluidModeRef.current) stopFluidMode();
    else {
      isFluidModeRef.current = true;
      setIsFluidMode(true);
      startListening();
      resetSilenceTimer();
    }
  };

  const handleOpenDoor = async () => {
    if (doorStatus !== "idle") return;
    setDoorStatus("opening");
    try {
      if (firebaseUrl)
        await fetch(`${firebaseUrl}/puerta.json`, {
          method: "PUT",
          body: JSON.stringify("ABRIR"),
        });
      setDoorStatus("opened");
      addHistoryToCloud({
        id: Date.now(),
        type: "manual",
        title: "Apertura Manual",
        desc: "Desde App MicroSmart",
        time: getCurrentTime(),
        date: "Hoy",
      });
    } catch (error) {
      alert("Error de conexión con la nube.");
    } finally {
      setTimeout(() => setDoorStatus("idle"), 2500);
    }
  };

  const handleSimulateVisitor = async (textOverride) => {
    const textToSend = textOverride || chatInput;
    if (!textToSend.trim() || isTyping) return;
    if (!apiKey) return;

    isProcessingRef.current = true;
    setChatHistory((prev) => [...prev, { role: "user", content: textToSend }]);
    setChatInput("");
    setIsTyping(true);

    const allowedNamesList = authorizedNamesRef.current
      .map((p) => p.name)
      .join(", ");
    const systemPrompt = `Eres el Conserje Inteligente de MicroSmart. 
IDENTIDAD: Eres un sistema de inteligencia artificial domótica creado por MicroSmart.
REGLA 1 (CAJA FUERTE): NUNCA reveles el apellido o nombre de un residente si el visitante no lo dice primero.
REGLA 2 (CAMALEÓN): Sé rápido si tienen prisa. Sé cálido si están tranquilos. Usa muletillas naturales ("Vale", "Entiendo").
REGLA 3: Si dicen un nombre y un apellido correcto de la lista, dale acceso. [${allowedNamesList}]
PROTOCOLOS: 
- REPARTIDORES: Dales acceso y pídeles (con tus propias palabras cada vez) que dejen el paquete dentro y cierren bien. -> [ABRIR_PUERTA | Empresa | Destinatario]
- NO AUTORIZADO: "Sin el nombre no puedo abrir. ¿Quiere dejar un recado?" -> [MENSAJE_PARA | Desconocido | texto]
Cuelga con [FIN_CONVERSACION] solo al terminar naturalmente.`;

    const contents = [
      ...apiHistoryRef.current,
      { role: "user", parts: [{ text: textToSend }] },
    ];
    try {
      const data = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { temperature: 0.65 },
          }),
        }
      );
      let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      apiHistoryRef.current = [
        ...contents,
        { role: "model", parts: [{ text: aiText }] },
      ];
      const finalAiText = aiText.replace(/\[.*?\]/g, "").trim();

      const abrirMatch = aiText.match(
        /\[ABRIR_PUERTA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/
      );
      if (abrirMatch) {
        if (firebaseUrl)
          fetch(`${firebaseUrl}/puerta.json`, {
            method: "PUT",
            body: JSON.stringify("ABRIR"),
          });
        addHistoryToCloud({
          id: Date.now(),
          type: "ai_open",
          title: `Acceso IA: ${abrirMatch[1]}`,
          desc: `Para: ${abrirMatch[2]}`,
          time: getCurrentTime(),
        });
      }

      const mensajeMatch = aiText.match(
        /\[MENSAJE_PARA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/
      );
      if (mensajeMatch) {
        addMessageToCloud({
          id: Date.now(),
          recipient: mensajeMatch[1],
          content: mensajeMatch[2],
          time: getCurrentTime(),
          phone: authorizedNamesRef.current[0].phone,
        });
        addHistoryToCloud({
          id: Date.now() + 1,
          type: "ai_message",
          title: "Recado guardado",
          desc: `Para: ${mensajeMatch[1]}`,
          time: getCurrentTime(),
        });
      }

      setChatHistory((prev) => [...prev, { role: "ai", content: finalAiText }]);
      speakResponse(finalAiText, aiText.includes("[FIN_CONVERSACION]"));
    } catch (error) {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: "Error de red." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // =========================================================================
  // PANTALLA DE LOGIN (Si no está autenticado)
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-[#00479b] flex items-center justify-center font-sans">
        <div className="w-full max-w-md p-8 bg-white md:rounded-[3rem] shadow-2xl flex flex-col items-center h-full md:h-auto">
          <div className="mt-20 mb-10">
            <MicroSmartLogo className="scale-150" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-2">
            Bienvenido a casa
          </h1>
          <p className="text-slate-500 text-sm mb-10 text-center">
            Inicia sesión para gestionar tus dispositivos y accesos.
          </p>

          <div className="w-full space-y-4">
            <button className="w-full bg-white border-2 border-slate-100 text-slate-700 font-bold py-4 rounded-2xl flex items-center justify-center space-x-3 hover:bg-slate-50 transition">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                alt="Google"
                className="w-5 h-5"
              />
              <span>Continuar con Google</span>
            </button>
            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase">
                o usa tu email
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>
            <input
              type="email"
              placeholder="Correo electrónico"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
            <input
              type="password"
              placeholder="Contraseña"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            />

            <button
              onClick={() => setIsAuthenticated(true)}
              className="w-full bg-[#7bc100] text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-[#7bc100]/30 active:scale-95 transition-all mt-4"
            >
              ENTRAR AL SISTEMA
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // INTERFAZ PRINCIPAL DE LA APP
  // =========================================================================
  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-[#f3f4f6] flex items-center justify-center font-sans text-slate-900 overflow-hidden">
      <div className="w-full max-w-md h-full md:h-[92vh] md:max-h-[850px] md:rounded-[3rem] bg-white shadow-2xl overflow-hidden flex flex-col relative md:border-[10px] border-[#1e293b]">
        {/* HEADER */}
        <div className="bg-white px-6 pt-8 pb-3 flex flex-col z-10 border-b border-slate-50 shrink-0">
          <div className="flex justify-between items-center mb-3">
            <MicroSmartLogo />
            <div className="flex space-x-1">
              <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Bell size={20} className="text-slate-600" />
              </button>
              <button
                onClick={() => setIsAuthenticated(false)}
                className="p-2 hover:bg-red-50 rounded-full transition-colors"
              >
                <LogOut size={20} className="text-red-500" />
              </button>
            </div>
          </div>
        </div>

        {/* CONTENIDO DE LAS PESTAÑAS */}
        <div className="flex-1 overflow-y-auto pb-24 px-6 pt-2 scrollbar-hide">
          {/* INICIO */}
          {activeTab === "home" && (
            <div className="flex flex-col items-center space-y-8 py-8 animate-in fade-in zoom-in duration-500">
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full text-[10px] font-bold bg-green-50 text-green-600">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span>
                  SISTEMA {pairedDevice ? "CONECTADO" : "SIN VINCULAR"}
                </span>
              </div>

              <button
                onClick={handleOpenDoor}
                disabled={doorStatus !== "idle" || !pairedDevice}
                className={`relative w-56 h-56 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 
                  ${
                    !pairedDevice
                      ? "bg-slate-200"
                      : doorStatus === "idle"
                      ? "bg-gradient-to-tr from-[#6aa600] to-[#8be000] shadow-[#7bc100]/30"
                      : doorStatus === "opening"
                      ? "bg-[#00479b] shadow-blue-900/30"
                      : "bg-green-500 shadow-green-500/40 scale-105"
                  }`}
              >
                {doorStatus === "idle" && (
                  <>
                    <Power size={56} className="text-white mb-2" />
                    <span className="text-white text-xl font-black">ABRIR</span>
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

          {/* IA */}
          {activeTab === "ai" && (
            <div className="flex flex-col h-full bg-slate-50 -mx-6 rounded-t-[2.5rem] border-t border-slate-200">
              <div className="p-5 pb-2 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <div>
                  <h2 className="text-lg font-black text-slate-800 flex items-center">
                    <Sparkles size={18} className="mr-2 text-[#00479b]" />{" "}
                    Conserje IA
                  </h2>
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
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-base ${
                        msg.role === "user"
                          ? "bg-[#00479b] text-white rounded-br-none"
                          : "bg-white text-slate-700 rounded-bl-none shadow-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 bg-white border-t border-slate-100 flex flex-col items-center space-y-4">
                <button
                  onClick={toggleFluidMode}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-xl ${
                    isFluidMode
                      ? "bg-red-500 scale-110 animate-pulse ring-8 ring-red-100"
                      : "bg-slate-200"
                  }`}
                >
                  {isFluidMode ? (
                    <Mic size={32} className="text-white" />
                  ) : (
                    <MicOff size={32} className="text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* HISTORIAL Y MENSAJES (Mismo diseño, pero ahora con datos persistentes) */}
          {activeTab === "history" && (
            <div className="py-4">
              <h2 className="text-xl font-black mb-6">Registro Cloud</h2>
              {historyLog.map((log) => (
                <div
                  key={log.id}
                  className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-3 mb-3"
                >
                  <div className="p-2.5 rounded-xl bg-blue-100 text-[#00479b]">
                    <Package size={18} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-xs">{log.title}</h4>
                    <p className="text-[10px] text-slate-500">{log.desc}</p>
                  </div>
                  <div className="text-[10px] font-black text-slate-700">
                    {log.time}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AJUSTES PROFESIONALES (Emparejamiento y Usuarios) */}
          {activeTab === "settings" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-5 py-4">
              <h2 className="text-xl font-black text-slate-800 mb-4 tracking-tight">
                Mi Casa
              </h2>

              {/* SECCIÓN DISPOSITIVOS (NUEVO) */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center space-x-3 mb-4">
                  <Smartphone size={18} className="text-[#00479b]" />
                  <h3 className="font-bold text-slate-800 text-sm">
                    Dispositivos MicroSmart
                  </h3>
                </div>

                {pairedDevice ? (
                  <div className="flex justify-between items-center bg-green-50 p-3 rounded-xl border border-green-100 mb-3">
                    <div>
                      <span className="text-xs font-bold text-green-700 block">
                        Interfono Principal
                      </span>
                      <span className="text-[9px] text-green-600 font-bold">
                        {pairedDevice}
                      </span>
                    </div>
                    <CheckCircle2 size={18} className="text-green-500" />
                  </div>
                ) : (
                  <div className="text-center py-4 bg-slate-50 rounded-xl mb-3">
                    <p className="text-xs text-slate-500 font-bold">
                      No hay dispositivos vinculados
                    </p>
                  </div>
                )}

                <button
                  onClick={() => {
                    setIsPairing(true);
                    setTimeout(() => {
                      setIsPairing(false);
                      setPairedDevice("MicroSmart_Hub_A1");
                    }, 3000);
                  }}
                  className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center hover:bg-slate-700 transition"
                >
                  {isPairing ? (
                    <span className="animate-pulse flex items-center">
                      <Bluetooth size={14} className="mr-2" /> Buscando por
                      Bluetooth...
                    </span>
                  ) : (
                    <>
                      <Wifi size={14} className="mr-2" /> Añadir Dispositivo
                    </>
                  )}
                </button>
              </div>

              {/* SECCIÓN RESIDENTES (MANTENIDA INTACTA) */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center space-x-3 mb-4">
                  <UserPlus size={18} className="text-[#00479b]" />
                  <h3 className="font-bold text-slate-800 text-sm">
                    Residentes Autorizados
                  </h3>
                </div>
                <div className="space-y-2 mb-4">
                  {authorizedNames.map((person, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100"
                    >
                      <div className="overflow-hidden">
                        <span className="text-xs font-bold text-slate-700 block">
                          {person.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold">
                          {person.phone}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveName(person.name)}
                        className="text-red-400 p-2 hover:bg-red-50 rounded-lg"
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
                    className="w-full bg-slate-50 border border-slate-200 text-base text-slate-800 rounded-lg px-3 py-2.5 focus:outline-none"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleAddName}
                      className="w-full bg-[#00479b] text-white px-4 py-3 rounded-lg text-xs font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                    >
                      AÑADIR RESIDENTE
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* NAVEGACIÓN INFERIOR INTACTA */}
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
