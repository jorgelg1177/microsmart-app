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
} from "lucide-react";

const fetchWithRetry = async (url, options, retries = 2, delay = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return await res.json();
  } catch (error) {
    if (retries > 0) {
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
      alt="MicroSmart Logo"
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

const getCurrentTime = () => {
  const now = new Date();
  return now.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [doorStatus, setDoorStatus] = useState("idle");
  const [authorizedNames, setAuthorizedNames] = useState([
    { name: "Jorge Loaiza", phone: "+34 600 000 000" },
    { name: "Karla León Núñez", phone: "+34 600 000 000" },
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
  const silenceTimerRef = useRef(null); // Temporizador para el auto-colgado
  const apiHistoryRef = useRef([]);
  const authorizedNamesRef = useRef(authorizedNames);
  const chatEndRef = useRef(null);

  const [chatHistory, setChatHistory] = useState([
    {
      role: "ai",
      content: "Hola, soy el asistente de MicroSmart. ¿A quién busca?",
    },
  ]);

  const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
  const aiModel = "gemini-2.5-flash";
  const firebaseUrl = process.env.REACT_APP_FIREBASE_URL;

  useEffect(() => {
    authorizedNamesRef.current = authorizedNames;
  }, [authorizedNames]);

  // Función para colgar automáticamente por inactividad
  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (isFluidModeRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        if (isFluidModeRef.current) {
          speakResponse(
            "Parece que no hay nadie ahí. Me retiro, que tenga un buen día."
          );
          setChatHistory((prev) => [
            ...prev,
            {
              role: "ai",
              content: "[Sistema: Conversación finalizada por inactividad]",
            },
          ]);
          stopFluidMode();
        }
      }, 15000); // 15 segundos de silencio y cuelga
    }
  };

  const stopFluidMode = () => {
    isFluidModeRef.current = false;
    setIsFluidMode(false);
    setIsListening(false);
    if (recognitionRef.current) recognitionRef.current.stop();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  };

  const speakResponse = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/\[.*?\]/g, "").trim();
      if (!cleanText) return;
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "es-ES";
      isSpeakingRef.current = true;
      utterance.onend = () => {
        isSpeakingRef.current = false;
        if (isFluidModeRef.current) {
          startListening();
          resetSilenceTimer();
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
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          isProcessingRef.current = true;
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          handleSimulateVisitor(transcript);
        }
      };
    }
    try {
      if (isFluidModeRef.current) recognitionRef.current.start();
    } catch (e) {}
  };

  const toggleFluidMode = () => {
    if (isFluidModeRef.current) {
      stopFluidMode();
    } else {
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
      await fetch(`${firebaseUrl}/puerta.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify("ABRIR"),
      });
      setDoorStatus("opened");
      setHistoryLog((prev) => [
        {
          id: Date.now(),
          type: "manual",
          title: "Apertura Manual",
          desc: "Acceso concedido",
          time: getCurrentTime(),
          date: "Hoy",
        },
        ...prev,
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setDoorStatus("idle"), 2000);
    }
  };

  const handleSimulateVisitor = async (textOverride) => {
    const textToSend = textOverride || chatInput;
    if (!textToSend.trim() || isTyping) return;
    isProcessingRef.current = true;
    setChatHistory((prev) => [...prev, { role: "user", content: textToSend }]);
    setIsTyping(true);

    const allowedNamesList = authorizedNamesRef.current
      .map((p) => p.name)
      .join(", ");
    const systemPrompt = `Eres el CONSERJE de MicroSmart. 
    REGLA DE ORO DE PRIVACIDAD: NUNCA digas un nombre completo o apellido si el visitante no lo ha dicho primero. 
    - Si dicen "Busco a Jorge", tú respondes: "Entendido, ¿podría indicarme el apellido completo de Jorge para confirmar?"
    - NUNCA digas: "¿Busca a Jorge Loaiza?" o "Jorge Loaiza no está".
    - Solo si dicen "Jorge Loaiza", tú confirmas que vive allí.
    
    LÓGICA CONVERSACIONAL:
    - Sé amable y humano. Si se despiden, despídete tú también.
    - Si el nombre/apellido coincide con [${allowedNamesList}], usa [ABRIR_PUERTA].
    - Usa [FIN_CONVERSACION] cuando la charla termine (despedida, puerta abierta o recado guardado).`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`;
      const contents = [
        ...apiHistoryRef.current,
        { role: "user", parts: [{ text: textToSend }] },
      ];
      const data = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.3 },
        }),
      });

      let aiText =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Disculpe, ¿podría repetir?";
      apiHistoryRef.current = [
        ...contents,
        { role: "model", parts: [{ text: aiText }] },
      ];

      const cleanAiText = aiText.replace(/\[.*?\]/g, "").trim();

      if (aiText.includes("[ABRIR_PUERTA")) {
        fetch(`${firebaseUrl}/puerta.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify("ABRIR"),
        });
        setHistoryLog((prev) => [
          {
            id: Date.now(),
            type: "ai_open",
            title: `Apertura IA`,
            desc: `Acceso verificado`,
            time: getCurrentTime(),
            date: "Hoy",
          },
          ...prev,
        ]);
      }

      setChatHistory((prev) => [...prev, { role: "ai", content: cleanAiText }]);

      if (aiText.includes("[FIN_CONVERSACION]")) {
        speakResponse(cleanAiText);
        setTimeout(stopFluidMode, 3000);
      } else {
        speakResponse(cleanAiText);
      }
    } catch (e) {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: "Error de conexión." },
      ]);
    } finally {
      setIsTyping(false);
      isProcessingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-[#f3f4f6] flex items-center justify-center font-sans overflow-hidden">
      <div className="w-full max-w-md h-full md:h-[92vh] md:max-h-[850px] md:rounded-[3rem] bg-white shadow-2xl overflow-hidden flex flex-col relative md:border-[10px] border-[#1e293b]">
        {/* Header */}
        <div className="bg-white px-6 pt-10 pb-3 border-b border-slate-50">
          <div className="flex justify-between items-center mb-4">
            <MicroSmartLogo className="h-[70px]" />
            <div className="w-10 h-10 bg-[#00479b] rounded-xl flex items-center justify-center text-white">
              <User size={20} />
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto pb-24 px-6 pt-4 scrollbar-hide">
          {activeTab === "home" && (
            <div className="flex flex-col items-center py-10 space-y-10">
              <button
                onClick={handleOpenDoor}
                className={`w-52 h-52 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all ${
                  doorStatus === "idle" ? "bg-[#7bc100]" : "bg-[#00479b]"
                }`}
              >
                <Power size={50} className="text-white mb-2" />
                <span className="text-white font-black text-xl">ABRIR</span>
              </button>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="flex flex-col h-full bg-slate-50 -mx-6 rounded-t-3xl border-t border-slate-200">
              <div className="p-4 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0">
                <h2 className="text-sm font-black text-slate-800">
                  Conserje Privado
                </h2>
                <div
                  className={`px-3 py-1 text-[8px] font-black rounded-full ${
                    isFluidMode
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isFluidMode ? "LLAMADA ACTIVA" : "DORMIDO"}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                        msg.role === "user"
                          ? "bg-[#00479b] text-white"
                          : "bg-white shadow-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-white border-t border-slate-100 flex flex-col items-center">
                <button
                  onClick={toggleFluidMode}
                  className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl ${
                    isFluidMode
                      ? "bg-red-500 ring-8 ring-red-50 animate-pulse"
                      : "bg-slate-200"
                  }`}
                >
                  <Mic
                    size={30}
                    className={isFluidMode ? "text-white" : "text-slate-400"}
                  />
                </button>
                <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase">
                  {isFluidMode ? "Escuchando..." : "Hablar con conserje"}
                </p>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="py-4 space-y-6">
              <h2 className="text-xl font-black text-slate-800">Residentes</h2>
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <div className="space-y-2 mb-6">
                  {authorizedNames.map((person, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-slate-50 p-3 rounded-xl"
                    >
                      <span className="text-xs font-bold">{person.name}</span>
                      <button
                        onClick={() => handleRemoveName(person.name)}
                        className="text-red-400 p-2"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre y Apellido"
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-4 py-3 mb-2 focus:outline-none"
                />
                <div className="flex space-x-2">
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Teléfono"
                    className="flex-1 bg-slate-50 border border-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none"
                  />
                  <button
                    onClick={handleAddName}
                    className="bg-[#00479b] text-white px-6 rounded-xl text-xs font-bold"
                  >
                    AÑADIR
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Menu */}
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
      className={`relative flex-1 flex flex-col items-center justify-center p-2 transition-all ${
        active ? "text-[#00479b]" : "text-slate-400"
      }`}
    >
      <div className={`transition-all ${active ? "scale-110" : "scale-100"}`}>
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
            {badge}
          </span>
        )}
      </div>
      <span
        className={`text-[7px] font-black uppercase mt-1 ${
          active ? "opacity-100" : "opacity-0 h-0"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
