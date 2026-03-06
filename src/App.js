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
  UserPlus2,
  KeyRound,
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
  // --- ESTADOS DE AUTENTICACIÓN AVANZADA ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // "login", "register", "reset"
  const [userName, setUserName] = useState(""); // Nombre del cliente
  const [userEmail, setUserEmail] = useState("");
  const [password, setPassword] = useState("");

  // --- ESTADOS DE CONTROL IOT ---
  const [isPairing, setIsPairing] = useState(false);
  const [pairedDevices, setPairedDevices] = useState([]);
  const [activeTab, setActiveTab] = useState("home");
  const [doorStatus, setDoorStatus] = useState("idle");

  // --- DATOS DINÁMICOS ---
  const [authorizedNames, setAuthorizedNames] = useState([]);
  const [historyLog, setHistoryLog] = useState([]);
  const [messagesList, setMessagesList] = useState([]);

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [isTyping, setIsTyping] = useState(false);
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
  const authorizedNamesRef = useRef([]);
  const chatEndRef = useRef(null);

  const [chatHistory, setChatHistory] = useState([
    {
      role: "ai",
      content:
        "Hola, soy el conserje inteligente de MicroSmart. ¿En qué puedo ayudarle?",
    },
  ]);

  const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
  const firebaseUrl = process.env.REACT_APP_FIREBASE_URL;
  const firebaseApiKey = process.env.REACT_APP_FIREBASE_API_KEY;

  // =========================================================================
  // SISTEMA DE SESIÓN (Memoria local)
  // =========================================================================
  useEffect(() => {
    const savedToken = localStorage.getItem("microSmart_token");
    const savedEmail = localStorage.getItem("microSmart_userEmail");
    const savedName = localStorage.getItem("microSmart_userName");
    const savedDevices = localStorage.getItem("microSmart_devices");

    if (savedToken && savedEmail) {
      setUserEmail(savedEmail);
      setUserName(savedName || savedEmail.split("@")[0]);
      setIsAuthenticated(true);
    }
    if (savedDevices) {
      setPairedDevices(JSON.parse(savedDevices));
    }
  }, []);

  // =========================================================================
  // FUNCIONES DE AUTENTICACIÓN FIREBASE (Login, Registro, Recuperación)
  // =========================================================================
  const handleLogin = async () => {
    if (userEmail.trim() === "" || password.trim() === "")
      return alert("Por favor, introduce tu correo y contraseña.");
    if (!firebaseApiKey)
      return alert(
        "Falta configurar la API KEY de Firebase en el archivo .env"
      );

    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userEmail,
            password: password,
            returnSecureToken: true,
          }),
        }
      );
      const data = await response.json();

      if (data.error) {
        alert(
          data.error.message === "INVALID_PASSWORD" ||
            data.error.message === "EMAIL_NOT_FOUND"
            ? "Correo o contraseña incorrectos."
            : `Error: ${data.error.message}`
        );
      } else {
        localStorage.setItem("microSmart_token", data.idToken);
        localStorage.setItem("microSmart_userEmail", data.email);
        localStorage.setItem(
          "microSmart_userName",
          data.displayName || data.email.split("@")[0]
        );
        setUserName(data.displayName || data.email.split("@")[0]);
        setIsAuthenticated(true);
        setPassword("");
      }
    } catch (error) {
      alert("Error conectando con el servidor de autenticación.");
    }
  };

  const handleRegister = async () => {
    if (
      userName.trim() === "" ||
      userEmail.trim() === "" ||
      password.trim() === ""
    )
      return alert("Por favor, rellena todos los campos.");
    if (!firebaseApiKey)
      return alert("Falta configurar la API KEY de Firebase.");

    try {
      // 1. Crear el usuario en Firebase
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userEmail,
            password: password,
            returnSecureToken: true,
          }),
        }
      );
      const data = await response.json();

      if (data.error) {
        alert(
          data.error.message === "EMAIL_EXISTS"
            ? "Ese correo ya está registrado."
            : `Error al registrar: ${data.error.message}`
        );
      } else {
        // 2. Guardar el nombre del usuario en su perfil de Firebase
        await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idToken: data.idToken,
              displayName: userName,
              returnSecureToken: true,
            }),
          }
        );

        // 3. Iniciar sesión automáticamente
        localStorage.setItem("microSmart_token", data.idToken);
        localStorage.setItem("microSmart_userEmail", userEmail);
        localStorage.setItem("microSmart_userName", userName);
        setIsAuthenticated(true);
        setPassword("");
      }
    } catch (error) {
      alert("Error conectando con el servidor de registro.");
    }
  };

  const handleResetPassword = async () => {
    if (userEmail.trim() === "")
      return alert(
        "Por favor, introduce el correo de tu cuenta para enviarte el enlace."
      );
    if (!firebaseApiKey)
      return alert("Falta configurar la API KEY de Firebase.");

    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestType: "PASSWORD_RESET",
            email: userEmail,
          }),
        }
      );
      const data = await response.json();

      if (data.error) {
        alert(`Error al enviar correo: ${data.error.message}`);
      } else {
        alert(
          "¡Correo de recuperación enviado! Revisa tu bandeja de entrada o spam para crear tu nueva contraseña."
        );
        setAuthMode("login");
      }
    } catch (error) {
      alert("Error de red.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("microSmart_token");
    localStorage.removeItem("microSmart_userEmail");
    localStorage.removeItem("microSmart_userName");
    setIsAuthenticated(false);
    setUserEmail("");
    setPassword("");
    setUserName("");
    setAuthMode("login");
  };

  // =========================================================================
  // LÓGICA DE LA APP IOT
  // =========================================================================
  const handlePairDevice = () => {
    setIsPairing(true);
    setTimeout(() => {
      setIsPairing(false);
      const newDevices = ["ESP32_Interfono_1"];
      setPairedDevices(newDevices);
      localStorage.setItem("microSmart_devices", JSON.stringify(newDevices));
    }, 3000);
  };

  useEffect(() => {
    if (isAuthenticated && firebaseUrl) {
      fetch(`${firebaseUrl}/residents.json`)
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            const list = Object.values(data);
            setAuthorizedNames(list);
            authorizedNamesRef.current = list;
          }
        });

      fetch(`${firebaseUrl}/history.json`)
        .then((res) => res.json())
        .then(
          (data) =>
            data &&
            setHistoryLog(Object.values(data).sort((a, b) => b.id - a.id))
        );

      fetch(`${firebaseUrl}/messages.json`)
        .then((res) => res.json())
        .then(
          (data) =>
            data &&
            setMessagesList(Object.values(data).sort((a, b) => b.id - a.id))
        );
    }
  }, [isAuthenticated, firebaseUrl]);

  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () =>
        window.speechSynthesis.getVoices();
    }
  }, []);

  const handleAddName = async () => {
    if (newName.trim() && newPhone.trim()) {
      const newUser = { name: newName.trim(), phone: newPhone.trim() };
      const updated = [...authorizedNames, newUser];
      setAuthorizedNames(updated);
      authorizedNamesRef.current = updated;
      if (firebaseUrl)
        await fetch(`${firebaseUrl}/residents/${Date.now()}.json`, {
          method: "PUT",
          body: JSON.stringify(newUser),
        });
      setNewName("");
      setNewPhone("");
    }
  };

  const handleRemoveName = (nameToRemove) => {
    setAuthorizedNames(
      authorizedNames.filter((person) => person.name !== nameToRemove)
    );
  };

  const saveToHistory = async (newLog) => {
    setHistoryLog((prev) => [newLog, ...prev]);
    if (firebaseUrl) {
      try {
        await fetch(`${firebaseUrl}/history.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newLog),
        });
      } catch (error) {}
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
      saveToHistory({
        id: Date.now(),
        type: "manual",
        title: "Apertura Manual",
        desc: `Por: ${userName}`,
        time: getCurrentTime(),
        date: "Hoy",
      });
    } catch (e) {
      alert("Error al conectar con la nube.");
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
          speakResponse(
            "Parece que no hay nadie. Me retiro, que tenga un excelente día.",
            true
          );
          setChatHistory((prev) => [
            ...prev,
            { role: "ai", content: "[Llamada finalizada por inactividad]" },
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
      const voices = window.speechSynthesis.getVoices();
      let bestVoice = voices.find(
        (v) =>
          (v.lang.startsWith("es-") || v.lang === "es") &&
          (v.name.includes("Premium") ||
            v.name.includes("Enhanced") ||
            v.name.includes("Natural"))
      );
      if (!bestVoice)
        bestVoice = voices.find(
          (v) => v.lang.startsWith("es-") || v.lang === "es"
        );
      if (bestVoice) utterance.voice = bestVoice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
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
      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (
          isFluidModeRef.current &&
          !isProcessingRef.current &&
          !isSpeakingRef.current
        )
          setTimeout(() => {
            if (isFluidModeRef.current && !isProcessingRef.current)
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
    }
    if (isFluidModeRef.current && !isProcessingRef.current)
      try {
        recognitionRef.current.start();
      } catch (e) {}
  };

  const toggleFluidMode = () => {
    if (isFluidModeRef.current) stopFluidMode();
    else {
      if ("speechSynthesis" in window)
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
      isFluidModeRef.current = true;
      setIsFluidMode(true);
      startListening();
      resetSilenceTimer();
    }
  };

  const handleSimulateVisitor = async (textOverride) => {
    const textToSend = textOverride || chatInput;
    if (!textToSend.trim() || isTyping) return;
    if (!apiKey) {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: "⚠️ Falla API KEY." },
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

    const allowedNamesList =
      authorizedNamesRef.current.length > 0
        ? authorizedNamesRef.current.map((p) => p.name).join(", ")
        : "Nadie";

    const systemPrompt = `Eres el Conserje Inteligente de MicroSmart. 
IDENTIDAD: Eres un producto de la empresa de domótica MicroSmart. No reveles apellidos.
PROTOCOLOS: Dales acceso a repartidores que nombren a un residente: [${allowedNamesList}] y pídeles que dejen el paquete dentro y cierren la puerta.
ETIQUETAS: [ABRIR_PUERTA | Empresa | Destinatario], [MENSAJE_PARA | nombre | texto], [FIN_CONVERSACION].`;

    const contents = [
      ...apiHistoryRef.current,
      { role: "user", parts: [{ text: textToSend }] },
    ];
    try {
      const data = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: contents,
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

      if (aiText.match(/\[ABRIR_PUERTA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/)) {
        if (firebaseUrl)
          fetch(`${firebaseUrl}/puerta.json`, {
            method: "PUT",
            body: JSON.stringify("ABRIR"),
          });
        saveToHistory({
          id: Date.now(),
          type: "ai_open",
          title: `Acceso IA: Reparto`,
          desc: `Autorizado`,
          time: getCurrentTime(),
        });
      }

      const mensajeMatch = aiText.match(
        /\[MENSAJE_PARA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/
      );
      if (mensajeMatch) {
        const msg = {
          id: Date.now(),
          recipient: mensajeMatch[1],
          content: mensajeMatch[2],
          time: getCurrentTime(),
          phone: "Desconocido",
        };
        setMessagesList((prev) => [msg, ...prev]);
        if (firebaseUrl)
          fetch(`${firebaseUrl}/messages/${msg.id}.json`, {
            method: "PUT",
            body: JSON.stringify(msg),
          });
      }

      setChatHistory((prev) => [...prev, { role: "ai", content: finalAiText }]);
      speakResponse(finalAiText, aiText.includes("[FIN_CONVERSACION]"));
    } catch (error) {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: `⚠️ Error de red.` },
      ]);
      if (isFluidModeRef.current)
        setTimeout(() => {
          startListening();
          resetSilenceTimer();
        }, 1500);
    } finally {
      setIsTyping(false);
      isProcessingRef.current = false;
    }
  };

  const handleSummarizeActivity = async () => {
    /* Mantener tu lógica original de resumen */
  };
  const handleDraftReply = async (message) => {
    /* Mantener tu lógica original de borrador */
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    const style = document.createElement("style");
    style.innerHTML = `* { touch-action: pan-y; -webkit-tap-highlight-color: transparent; } .scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`;
    document.head.appendChild(style);
    return () => {
      document.body.style.overflow = "auto";
      document.body.style.position = "static";
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping]);

  // =================================================================================
  // PANTALLA 1: SISTEMA MULTI-MODO DE AUTENTICACIÓN
  // =================================================================================
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-[#f3f4f6] flex items-center justify-center font-sans p-4">
        <div className="w-full max-w-md bg-white rounded-[3rem] p-8 shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
          <MicroSmartLogo className="h-[110px] w-auto mb-6 flex items-center justify-center" />

          <h2 className="text-2xl font-black text-slate-800 mb-1">
            {authMode === "login"
              ? "Bienvenido a casa"
              : authMode === "register"
              ? "Crea tu cuenta"
              : "Recuperar acceso"}
          </h2>
          <p className="text-slate-500 text-sm mb-6 text-center font-medium">
            {authMode === "login"
              ? "Inicia sesión en MicroSmart"
              : authMode === "register"
              ? "Empieza a proteger tu hogar"
              : "Te enviaremos un correo seguro"}
          </p>

          <div className="w-full space-y-4">
            {/* Formulario Dinámico */}
            <div className="space-y-3">
              {authMode === "register" && (
                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-slate-800 font-medium"
                />
              )}

              <input
                type="email"
                placeholder="Correo electrónico"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-slate-800 font-medium"
              />

              {authMode !== "reset" && (
                <input
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-slate-800 font-medium"
                />
              )}
            </div>

            {/* Botón de Acción Principal */}
            {authMode === "login" && (
              <button
                onClick={handleLogin}
                className="w-full bg-[#00479b] hover:bg-blue-800 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-blue-900/30 active:scale-95 transition-all flex items-center justify-center"
              >
                <Lock size={20} className="mr-2" /> INICIAR SESIÓN
              </button>
            )}

            {authMode === "register" && (
              <button
                onClick={handleRegister}
                className="w-full bg-[#7bc100] hover:bg-green-600 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-green-600/30 active:scale-95 transition-all flex items-center justify-center"
              >
                <UserPlus2 size={20} className="mr-2" /> REGISTRARSE
              </button>
            )}

            {authMode === "reset" && (
              <button
                onClick={handleResetPassword}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-slate-900/30 active:scale-95 transition-all flex items-center justify-center"
              >
                <KeyRound size={20} className="mr-2" /> ENVIAR ENLACE
              </button>
            )}

            {/* Enlaces de navegación entre modos */}
            <div className="flex flex-col items-center space-y-3 pt-4">
              {authMode === "login" && (
                <>
                  <button
                    onClick={() => setAuthMode("reset")}
                    className="text-sm font-bold text-slate-500 hover:text-[#00479b] transition"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                  <button
                    onClick={() => {
                      setAuthMode("register");
                      setPassword("");
                    }}
                    className="text-sm font-bold text-[#00479b] hover:text-blue-800 transition"
                  >
                    ¿No tienes cuenta?{" "}
                    <span className="underline">Regístrate</span>
                  </button>
                </>
              )}
              {authMode !== "login" && (
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setPassword("");
                  }}
                  className="text-sm font-bold text-[#00479b] hover:text-blue-800 transition"
                >
                  ← Volver al inicio de sesión
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =================================================================================
  // PANTALLA 2: APLICACIÓN PRINCIPAL
  // =================================================================================
  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-[#f3f4f6] flex items-center justify-center font-sans text-slate-900 overflow-hidden">
      <div className="w-full max-w-md h-full md:h-[92vh] md:max-h-[850px] md:rounded-[3rem] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col relative md:border-[10px] border-[#1e293b]">
        <div className="hidden md:block h-6 w-1/3 bg-[#1e293b] absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl z-30"></div>
        <div className="bg-white px-6 pt-8 pb-3 flex flex-col z-10 border-b border-slate-50 shrink-0">
          <div className="flex justify-between items-center mb-3">
            <MicroSmartLogo className="h-[110px] w-auto flex items-center" />
            <div className="flex space-x-1">
              <button className="p-2 hover:bg-slate-100 rounded-full transition-colors relative">
                <Bell size={20} className="text-slate-600" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 rounded-full transition-colors"
              >
                <LogOut size={20} className="text-red-500" />
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-10 h-10 bg-[#00479b] rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/10">
              <User size={20} className="text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-base font-bold text-slate-800 leading-tight truncate">
                Hola, {userName}
              </h1>
              <p className="text-[10px] text-slate-500 font-medium flex items-center">
                <MapPin size={10} className="mr-1 text-[#7bc100]" />{" "}
                microsmart.es
              </p>
            </div>
          </div>
        </div>

        {/* ... EL RESTO DE PESTAÑAS QUEDAN EXACTAMENTE IGUAL ... */}

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
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 bg-white border-t border-slate-100 flex flex-col items-center">
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
          )}
          {activeTab === "history" && (
            <div className="py-4">
              <h2 className="text-xl font-black text-slate-800 mb-6">
                Registro
              </h2>
              {historyLog.map((log, i) => (
                <div
                  key={i}
                  className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-3 mb-3"
                >
                  <div className="p-2.5 rounded-xl bg-blue-100 text-[#00479b]">
                    <Package size={18} />
                  </div>
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
          )}
          {activeTab === "settings" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-5 py-4">
              <h2 className="text-xl font-black text-slate-800 mb-6">
                Configuración
              </h2>
              <div className="bg-slate-800 rounded-[2rem] p-6 shadow-lg border border-slate-700">
                <div className="flex items-center space-x-3 mb-6 text-white">
                  <Smartphone size={18} className="text-[#7bc100]" />
                  <h3 className="font-bold text-sm">Dispositivos MicroSmart</h3>
                </div>
                {pairedDevices.length > 0 ? (
                  <div className="space-y-2 mb-6">
                    {pairedDevices.map((dev, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex justify-between items-center"
                      >
                        <div>
                          <span className="text-white font-bold text-xs block">
                            {dev}
                          </span>
                          <span className="text-green-400 text-[10px] font-bold">
                            Vinculado y Activo
                          </span>
                        </div>
                        <CheckCircle2 size={18} className="text-green-500" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-slate-900 rounded-xl mb-6 border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold">
                      No hay dispositivos vinculados
                    </p>
                  </div>
                )}
                <button
                  onClick={handlePairDevice}
                  disabled={isPairing}
                  className="w-full bg-[#00479b] hover:bg-blue-600 text-white font-bold py-4 rounded-xl text-xs flex items-center justify-center transition-all shadow-xl active:scale-95"
                >
                  {isPairing ? (
                    <span className="animate-pulse flex items-center">
                      <Bluetooth size={16} className="mr-2" /> Escaneando...
                    </span>
                  ) : (
                    <>
                      <Bluetooth size={16} className="mr-2" /> Emparejar
                      Dispositivo
                    </>
                  )}
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
                        className="text-red-400 p-2 hover:bg-red-50 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
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
