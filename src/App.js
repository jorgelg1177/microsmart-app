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
  Copy,
  Check,
  Plus,
  Edit2,
  Trash2,
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
const firebaseConfig = {
  apiKey: "AIzaSyAyQe2Ev40lMOx6_gNvMGv6P86oRrGlHvg",
  authDomain: "portero-a87d8.firebaseapp.com",
  databaseURL:
    "https://portero-a87d8-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "portero-a87d8",
  storageBucket: "portero-a87d8.firebasestorage.app",
  messagingSenderId: "779001621682",
  appId: "1:779001621682:web:ea0fed5bddc97e489dedab",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
// =========================================================================

const fetchWithRetry = async (url, options, retries = 2, delay = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      if (res.status === 401)
        throw new Error("Error 401: Clave de API inválida.");
      if (res.status === 404)
        throw new Error("Error 404: El modelo de IA no se encuentra.");
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

const MicroSmartLogo = ({ className, onClick }) => (
  <div
    className={`${className} cursor-pointer hover:opacity-80 transition-opacity`}
    onClick={onClick}
  >
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

const getFriendlyAuthError = (errorMsg) => {
  const msg = errorMsg.toLowerCase();
  if (msg.includes("invalid-email"))
    return "El correo electrónico no es válido.";
  if (msg.includes("user-not-found") || msg.includes("invalid-credential"))
    return "Correo o contraseña incorrectos.";
  if (msg.includes("wrong-password"))
    return "La contraseña es incorrecta. Inténtalo de nuevo.";
  if (msg.includes("email-already-in-use"))
    return "Este correo ya está registrado en MicroSmart.";
  if (msg.includes("weak-password"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (msg.includes("network-request-failed"))
    return "Error de conexión. Verifica tu internet.";
  return "Ocurrió un error. Verifica tus datos e inténtalo de nuevo.";
};

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

  const [wifiModalOpen, setWifiModalOpen] = useState(false);
  const [showiOSModal, setShowiOSModal] = useState(false);
  const [copiedUID, setCopiedUID] = useState(false);

  const [tempSsid, setTempSsid] = useState("");
  const [tempPass, setTempPass] = useState("");
  const [bleCharacteristic, setBleCharacteristic] = useState(null);
  const [availableNetworks, setAvailableNetworks] = useState([]);

  const [isListening, setIsListening] = useState(false);
  const [isFluidMode, setIsFluidMode] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activitySummary, setActivitySummary] = useState("");
  const [draftingId, setDraftingId] = useState(null);

  const [aiEnabled, setAiEnabled] = useState(true);
  const [deviceOnline, setDeviceOnline] = useState(false);

  // --- NUEVOS ESTADOS DE PERFIL ---
  const [userName, setUserName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  const isFluidModeRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const apiHistoryRef = useRef([]);
  const authorizedNamesRef = useRef(authorizedNames);
  const chatEndRef = useRef(null);
  const lastBeatRef = useRef(Date.now());

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
        setDeviceOnline(false);
        setAiEnabled(true);
        setUserName("");
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

      onValue(ref(db, `users/${uid}/puerta/heartbeat`), (s) => {
        if (s.exists()) {
          lastBeatRef.current = Date.now();
          setDeviceOnline(true);
        }
      });

      onValue(ref(db, `users/${uid}/settings/aiEnabled`), (s) => {
        if (s.exists()) setAiEnabled(s.val());
      });

      // Cargar Nombre Personalizado
      onValue(ref(db, `users/${uid}/settings/userName`), (s) => {
        if (s.exists()) setUserName(s.val());
        else setUserName(currentUser.email.split("@")[0]); // Fallback al nombre del correo
      });
    }
  }, [currentUser]);

  useEffect(() => {
    const checker = setInterval(() => {
      if (Date.now() - lastBeatRef.current > 12000) setDeviceOnline(false);
    }, 3000);
    return () => clearInterval(checker);
  }, []);

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
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (authMode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
        setAuthMessage("Cuenta creada con éxito.");
      } else if (authMode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setAuthMessage("Revisa tu correo para cambiar la contraseña.");
      }
    } catch (error) {
      setAuthError(getFriendlyAuthError(error.message));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);
  const saveToHistory = async (newLog) => {
    if (currentUser)
      await push(ref(db, `users/${currentUser.uid}/history`), newLog);
  };
  const saveMessage = async (newMessage) => {
    if (currentUser)
      await push(ref(db, `users/${currentUser.uid}/messages`), newMessage);
  };

  // --- ACTUALIZAR PERFIL ---
  const handleSaveName = async () => {
    if (currentUser && tempName.trim() !== "") {
      await set(
        ref(db, `users/${currentUser.uid}/settings/userName`),
        tempName.trim()
      );
      setIsEditingName(false);
    }
  };

  // --- GESTIÓN DE DISPOSITIVOS ---
  const handleRemoveDevice = async (deviceNameToRemove) => {
    if (!currentUser) return;
    const isConfirmed = window.confirm(
      `¿Estás seguro de que quieres desvincular el equipo "${deviceNameToRemove}"?`
    );
    if (isConfirmed) {
      const updatedDevices = pairedDevices.filter(
        (dev) => dev !== deviceNameToRemove
      );
      await set(ref(db, `users/${currentUser.uid}/devices`), updatedDevices);
    }
  };

  const iniciarConexionBluetooth = async () => {
    if (!navigator.bluetooth) {
      setShowiOSModal(true);
      return;
    }
    setIsPairing(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "MicroSmart Conserje" }],
        optionalServices: ["19b10000-e8f2-537e-4f6c-d104768a1214"],
      });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(
        "19b10000-e8f2-537e-4f6c-d104768a1214"
      );
      const characteristic = await service.getCharacteristic(
        "19b10001-e8f2-537e-4f6c-d104768a1214"
      );
      setBleCharacteristic(characteristic);
      const val = await characteristic.readValue();
      const decoded = new TextDecoder().decode(val);
      if (decoded) {
        const networksArray = decoded.split(",").filter((n) => n.trim() !== "");
        const uniqueNetworks = [...new Set(networksArray)];
        setAvailableNetworks(uniqueNetworks);
        if (uniqueNetworks.length > 0) {
          setTempSsid(uniqueNetworks[0]);
        }
      }
      setWifiModalOpen(true);
    } catch (error) {
      if (
        error.message &&
        (error.message.includes("Bluetooth") ||
          error.message.includes("supported"))
      ) {
        setShowiOSModal(true);
      } else {
        alert(
          "No se pudo conectar. Verifica que el Conserje MicroSmart esté encendido."
        );
      }
    } finally {
      setIsPairing(false);
    }
  };

  const enviarDatosAlDispositivo = async () => {
    if (!bleCharacteristic || !tempSsid || !tempPass || !currentUser) return;
    try {
      const payload = `${tempSsid}||${tempPass}||${currentUser.uid}`;
      const encoder = new TextEncoder();
      await bleCharacteristic.writeValue(encoder.encode(payload));
      const newDeviceName = "Conserje Inteligente";
      if (!pairedDevices.includes(newDeviceName)) {
        const updatedDevices = [...pairedDevices, newDeviceName];
        await set(ref(db, `users/${currentUser.uid}/devices`), updatedDevices);
      }
      alert("¡Producto configurado con éxito! Se está conectando a tu red.");
      setWifiModalOpen(false);
      setTempSsid("");
      setTempPass("");
      setBleCharacteristic(null);
    } catch (error) {
      alert("Hubo un error enviando los datos al dispositivo.");
    }
  };

  const handleCopyUID = () => {
    if (currentUser) {
      navigator.clipboard.writeText(currentUser.uid);
      setCopiedUID(true);
      setTimeout(() => setCopiedUID(false), 3000);
    }
  };

  const handleFinishWiFiSetup = async () => {
    const newDeviceName = "Conserje Inteligente";
    if (!pairedDevices.includes(newDeviceName)) {
      const updatedDevices = [...pairedDevices, newDeviceName];
      await set(ref(db, `users/${currentUser.uid}/devices`), updatedDevices);
    }
    setShowiOSModal(false);
  };

  const toggleAiState = async (e) => {
    if (e) e.stopPropagation(); // Evita que al tocar el botón se active el click de la tarjeta
    if (currentUser) {
      const newState = !aiEnabled;
      setAiEnabled(newState);
      await set(
        ref(db, `users/${currentUser.uid}/settings/aiEnabled`),
        newState
      );
      if (!newState && isFluidModeRef.current) stopFluidMode();
    }
  };

  const handleAddName = async () => {
    if (newName.trim() && newPhone.trim() && currentUser) {
      const formattedPhone = newPhone.startsWith("+")
        ? newPhone.trim()
        : `+34 ${newPhone.trim()}`;
      const updatedNames = [
        ...authorizedNames,
        { name: newName.trim(), phone: formattedPhone },
      ];
      await set(
        ref(db, `users/${currentUser.uid}/authorizedNames`),
        updatedNames
      );
      setNewName("");
      setNewPhone("");
    }
  };

  const handleRemoveName = async (nameToRemove) => {
    if (!currentUser) return;
    const updatedNames = authorizedNames.filter(
      (person) => person.name !== nameToRemove
    );
    await set(
      ref(db, `users/${currentUser.uid}/authorizedNames`),
      updatedNames
    );
  };

  const handleOpenDoor = async () => {
    if (doorStatus !== "idle" || !currentUser || !deviceOnline) return;
    setDoorStatus("opening");
    try {
      await set(ref(db, `users/${currentUser.uid}/puerta/estado`), "ABRIR");
      setDoorStatus("opened");
      saveToHistory({
        id: Date.now(),
        type: "manual",
        title: "Apertura Manual",
        desc: `Desde App por ${userName}`,
        time: getCurrentTime(),
        date: "Hoy",
      });
    } catch (error) {
      alert("Error de conexión con la base de datos.");
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
          speakResponse(
            "Parece que no hay nadie. Me retiro, que tenga un excelente día.",
            true
          );
          setChatHistory((prev) => [
            ...prev,
            {
              role: "ai",
              content:
                "Parece que no hay nadie. Me retiro, que tenga un excelente día. [Llamada finalizada por inactividad]",
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
    if (!apiKey) return setActivitySummary("Falta configurar la clave API.");
    if (historyLog.length === 0)
      return setActivitySummary(
        "No hay actividad registrada hoy para resumir."
      );
    if (isSummarizing) return;
    setIsSummarizing(true);
    const activityData = historyLog
      .map((log) => `${log.time}: ${log.title} - ${log.desc}`)
      .join("\n");
    const prompt = `Resume brevemente la actividad de hoy del portero de forma profesional: ${activityData}`;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`;
      const response = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      setActivitySummary(
        response.candidates?.[0]?.content?.parts?.[0]?.text ||
          "No hay resumen disponible."
      );
    } catch (e) {
      setActivitySummary("Error: " + e.message);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDraftReply = async (message) => {
    if (!apiKey) return alert("Falta configurar la clave API.");
    setDraftingId(message.id);
    const prompt = `Redacta una respuesta de WhatsApp muy corta y amable para este recado: "${message.content}"`;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`;
      const response = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const draft = response.candidates?.[0]?.content?.parts?.[0]?.text;
      const whatsappUrl = `https://wa.me/${message.phone.replace(
        /\D/g,
        ""
      )}?text=${encodeURIComponent(draft.trim())}`;
      window.open(whatsappUrl, "_blank");
    } catch (e) {
      console.error(e);
    } finally {
      setDraftingId(null);
    }
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
          (v.name.includes("Premium") ||
            v.name.includes("Enhanced") ||
            v.name.includes("Google") ||
            v.name.includes("Siri") ||
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
        ) {
          setTimeout(() => {
            if (
              isFluidModeRef.current &&
              !isProcessingRef.current &&
              !isSpeakingRef.current
            )
              try {
                recognitionRef.current.start();
              } catch (e) {}
          }, 300);
        }
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
    if (!aiEnabled) return;
    if (isFluidModeRef.current) {
      stopFluidMode();
    } else {
      if ("speechSynthesis" in window) {
        const unlock = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(unlock);
      }
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
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    meta.content =
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    const style = document.createElement("style");
    style.innerHTML = `* { touch-action: pan-y; -webkit-tap-highlight-color: transparent; } input, textarea, select { font-size: 16px !important; } .scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`;
    document.head.appendChild(style);
    return () => {
      document.body.style.overflow = "auto";
      document.body.style.position = "static";
      document.head.removeChild(style);
    };
  }, []);

  const handleSimulateVisitor = async (textOverride) => {
    const textToSend = textOverride || chatInput;
    if (!textToSend.trim() || isTyping || !aiEnabled) return;

    if (!apiKey) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: "ai",
          content: "⚠️ Sistema: No se detecta la clave API de Gemini.",
        },
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

    const nombresPermitidos = authorizedNamesRef.current
      .map((p) => p.name)
      .join(", ");
    const listaActual =
      nombresPermitidos.length > 0
        ? nombresPermitidos
        : "NADIE. (La lista está vacía, tienes PROHIBIDO abrir la puerta)";

    const systemPrompt = `Eres el Conserje Inteligente desarrollado por la empresa MicroSmart.
    IMPORTANTE SOBRE TU IDENTIDAD: MicroSmart es una empresa tecnológica líder en domótica y sistemas autónomos.
    Tú eres uno de sus productos, instalado para proteger esta vivienda privada. La casa NO se llama MicroSmart.

    REGLA 1 - SEGURIDAD IMPENETRABLE Y LISTA DE ACCESO:
    ESTA ES TU LISTA DE RESIDENTES AUTORIZADOS EN ESTE MOMENTO: [${listaActual}].
    - Si la lista dice "NADIE", tienes absolutamente PROHIBIDO abrir la puerta a nadie, sin excepciones.
    - Si el visitante busca a alguien que NO está exactamente en esa lista, el acceso es DENEGADO.
    - PRIVACIDAD: NUNCA reveles ni confirmes nombres si el visitante no los ha dicho primero. 
    - COMPROBACIÓN: Si el visitante dice un nombre de la lista, debes pedirle el APELLIDO para confirmar. Si no se sabe el apellido o no coincide con la lista, DENEGADO.

    REGLA 2 - MODO CAMALEÓN Y NATURALIDAD (CERO ROBOT):
    - Usa muletillas humanas al inicio de tus frases: "Vale", "Entiendo", "A ver...", "De acuerdo", "Perfecto", "Un segundo".
    - NO repitas "por favor" o "gracias" en cada frase. Úsalas esporádicamente para que suene natural.
    - Si el visitante tiene prisa (ej. "¡Amazon!", "Paquete"): Sé rápido y directo. Si está tranquilo, sé cálido.

    PROTOCOLOS ESTRICTOS DE SALIDA (Usa SIEMPRE las etiquetas al final de tu respuesta):
    - ACCESO AUTORIZADO (Solo si pasó todas las pruebas de la regla 1): -> [ABRIR_PUERTA | Empresa/Visita | Destinatario]
    - RECADOS (Si no está en la lista o no sabe el apellido): "Lo siento, no le puedo abrir. Si quiere déjeme un recado y se lo paso." -> [MENSAJE_PARA | Desconocido | texto]
    - RECHAZO DIRECTO: [ACCESO_DENEGADO | Motivo]

    REGLA DE AUTO-COLGADO:
    Añade la etiqueta [FIN_CONVERSACION] ÚNICAMENTE cuando la conversación termine de forma natural.`;

    let validApiHistory = [...apiHistoryRef.current];
    let combinedText = textToSend;
    if (
      validApiHistory.length > 0 &&
      validApiHistory[validApiHistory.length - 1].role === "user"
    ) {
      const lastMsg = validApiHistory.pop();
      combinedText = lastMsg.parts[0].text + ". " + textToSend;
    }
    const newApiMsg = { role: "user", parts: [{ text: combinedText }] };
    const contents = [...validApiHistory, newApiMsg];

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
      if (!aiText) throw new Error("Respuesta vacía del servidor.");

      const updatedHistory = [
        ...contents,
        { role: "model", parts: [{ text: aiText }] },
      ];
      setApiHistory(updatedHistory);
      apiHistoryRef.current = updatedHistory;

      let actionType = null,
        endConversation = false;
      const finalAiText = aiText.replace(/\[.*?\]/g, "").trim();

      const abrirMatch = aiText.match(
        /\[ABRIR_PUERTA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/
      );
      if (abrirMatch) {
        actionType = "opened";
        const empresa = abrirMatch[1].trim();
        const destinatario = abrirMatch[2].trim();
        if (currentUser) {
          set(ref(db, `users/${currentUser.uid}/puerta/estado`), "ABRIR").catch(
            (e) => console.error(e)
          );
        }
        saveToHistory({
          id: Date.now(),
          type: "ai_open",
          title: `Acceso IA: ${empresa}`,
          desc: `Para: ${destinatario}`,
          time: getCurrentTime(),
          date: "Hoy",
        });
      }

      const mensajeMatch = aiText.match(
        /\[MENSAJE_PARA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/
      );
      if (mensajeMatch) {
        actionType = "message_saved";
        const destinatario = mensajeMatch[1].trim();
        const textoMensaje = mensajeMatch[2].trim();
        saveMessage({
          id: Date.now(),
          recipient: destinatario,
          content: textoMensaje,
          time: getCurrentTime(),
          phone:
            authorizedNamesRef.current.find(
              (p) =>
                p.name === destinatario ||
                p.name.includes(destinatario.split(" ")[0])
            )?.phone || "Desconocido",
        });
        saveToHistory({
          id: Date.now() + 1,
          type: "ai_message",
          title: `Recado guardado`,
          desc: `Para: ${destinatario}`,
          time: getCurrentTime(),
          date: "Hoy",
        });
      }

      const rechazoMatch = aiText.match(/\[ACCESO_DENEGADO\s*\|\s*(.*?)\]/);
      if (rechazoMatch) {
        actionType = "denied";
        const motivo = rechazoMatch[1].trim();
        saveToHistory({
          id: Date.now(),
          type: "ai_denied",
          title: `Acceso Denegado`,
          desc: motivo,
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
        { role: "ai", content: `⚠️ Error de red. Intente de nuevo.` },
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
            {authMode === "login"
              ? "Inicia sesión para gestionar tu hogar MicroSmart"
              : authMode === "register"
              ? "Regístrate para vincular tus dispositivos"
              : "Te enviaremos un enlace para restaurar tu contraseña"}
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
      {/* 1. MODAL BLUETOOTH */}
      {wifiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-center mb-4 text-[#00479b]">
              <Bluetooth size={32} />
            </div>
            <h3 className="text-xl font-black text-center text-slate-800 mb-2">
              Producto MicroSmart
            </h3>
            <p className="text-xs text-center text-slate-500 mb-6">
              Dispositivo enlazado. Selecciona tu red WiFi para darle acceso a
              internet.
            </p>
            <div className="space-y-3">
              {availableNetworks.length > 0 ? (
                <select
                  value={tempSsid}
                  onChange={(e) => setTempSsid(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-sm font-medium text-slate-700"
                >
                  <option value="" disabled>
                    Elige tu red WiFi...
                  </option>
                  {availableNetworks.map((net, i) => (
                    <option key={i} value={net}>
                      {net}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Escribe el nombre de tu WiFi"
                  value={tempSsid}
                  onChange={(e) => setTempSsid(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-sm font-medium"
                />
              )}
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
                onClick={() => {
                  setWifiModalOpen(false);
                  setBleCharacteristic(null);
                }}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={enviarDatosAlDispositivo}
                disabled={!tempSsid || !tempPass}
                className="flex-1 py-3 bg-[#00479b] text-white rounded-xl font-bold text-sm shadow-lg flex justify-center items-center"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL "ANTI-TONTOS" PARA iOS CON "LLAVE DE SEGURIDAD" */}
      {showiOSModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Wifi size={32} className="text-[#00479b]" />
            </div>
            <h3 className="text-xl font-black text-center text-slate-800 mb-2">
              Enlazar Producto MicroSmart
            </h3>
            <p className="text-xs text-center text-slate-500 mb-6 px-2">
              Tu navegador bloquea el Bluetooth. Usaremos nuestra conexión Wi-Fi
              segura de forma manual.
            </p>

            <div className="w-full space-y-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 relative">
                <span className="absolute -top-3 left-4 bg-[#00479b] text-white text-[9px] font-black px-2 py-1 rounded-full">
                  PASO 1
                </span>
                <p className="text-xs font-bold text-slate-700 mb-2">
                  Copia tu Llave de Seguridad MicroSmart:
                </p>
                <button
                  onClick={handleCopyUID}
                  className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center transition-all ${
                    copiedUID
                      ? "bg-green-500 text-white"
                      : "bg-white border border-[#00479b] text-[#00479b] hover:bg-blue-50"
                  }`}
                >
                  {copiedUID ? (
                    <>
                      <Check size={16} className="mr-2" /> ¡LLAVE COPIADA!
                    </>
                  ) : (
                    <>
                      <Copy size={16} className="mr-2" /> COPIAR LLAVE
                    </>
                  )}
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 relative">
                <span className="absolute -top-3 left-4 bg-slate-800 text-white text-[9px] font-black px-2 py-1 rounded-full">
                  PASO 2
                </span>
                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                  Ve a los ajustes de tu teléfono, busca redes Wi-Fi y conéctate
                  a:
                  <br />
                  <strong className="block text-center text-[#7bc100] text-sm mt-2">
                    MicroSmart_Conserje
                  </strong>
                </p>
                <p className="text-[10px] text-slate-400 mt-2 text-center italic">
                  La pantalla de configuración saltará sola.
                </p>
              </div>
            </div>

            <div className="w-full flex space-x-3">
              <button
                onClick={() => setShowiOSModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm"
              >
                Cerrar
              </button>
              <button
                onClick={handleFinishWiFiSetup}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm shadow-lg flex justify-center items-center"
              >
                Ya lo hice
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md h-full md:h-[92vh] md:max-h-[850px] md:rounded-[3rem] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col relative md:border-[10px] border-[#1e293b]">
        {/* --- HEADER SUPERIOR (AHORA CON CLICK EN LOGO Y PERFIL EDITABLE) --- */}
        <div className="bg-white px-6 pt-8 pb-3 flex flex-col z-10 border-b border-slate-50 shrink-0">
          <div className="flex justify-between items-center mb-3">
            <MicroSmartLogo
              className="h-[110px] w-auto flex items-center"
              onClick={() => setActiveTab("home")}
            />
            <div className="flex space-x-1">
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 rounded-full transition-colors"
              >
                <LogOut size={20} className="text-red-500" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#00479b] rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/10 shrink-0">
                <User size={20} className="text-white" />
              </div>
              <div className="overflow-hidden">
                {isEditingName ? (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      autoFocus
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onBlur={handleSaveName}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                      }}
                      className="bg-white border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800 focus:outline-none w-28"
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="text-base font-bold text-slate-800 leading-tight truncate">
                      {userName}
                    </h1>
                    <p className="text-[9px] text-slate-400 font-medium truncate">
                      {currentUser.email}
                    </p>
                  </>
                )}
              </div>
            </div>
            {!isEditingName && (
              <button
                onClick={() => {
                  setTempName(userName);
                  setIsEditingName(true);
                }}
                className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
              >
                <Edit2 size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 px-6 pt-2 scrollbar-hide bg-slate-50/50">
          {/* ========================================================= */}
          {/* TAB: INICIO (HOME) REESTRUCTURADO COMO DASHBOARD          */}
          {/* ========================================================= */}
          {activeTab === "home" && (
            <div className="flex flex-col items-center py-6 animate-in fade-in zoom-in duration-500 h-full">
              {/* STATUS INDICATOR */}
              <div
                className={`inline-flex items-center space-x-2 px-4 py-1.5 rounded-full text-[10px] font-bold transition-all mb-8 ${
                  pairedDevices.length === 0
                    ? "bg-amber-50 text-amber-600"
                    : !deviceOnline
                    ? "bg-red-50 text-red-600"
                    : doorStatus === "idle"
                    ? "bg-green-50 text-green-600"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    pairedDevices.length === 0
                      ? "bg-amber-500"
                      : !deviceOnline
                      ? "bg-red-500 animate-pulse"
                      : doorStatus === "idle"
                      ? "bg-green-500"
                      : "bg-blue-500 animate-pulse"
                  }`}
                ></div>
                <span>
                  {pairedDevices.length === 0
                    ? "SIN DISPOSITIVOS"
                    : !deviceOnline
                    ? "SISTEMA OFFLINE"
                    : "SISTEMA ONLINE"}
                </span>
              </div>

              {/* BOTÓN GIGANTE CENTRAL */}
              <button
                onClick={handleOpenDoor}
                disabled={
                  doorStatus !== "idle" ||
                  pairedDevices.length === 0 ||
                  !deviceOnline
                }
                className={`relative w-48 h-48 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 ${
                  pairedDevices.length === 0 || !deviceOnline
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
                      size={48}
                      className={`${
                        pairedDevices.length === 0 || !deviceOnline
                          ? "text-slate-400"
                          : "text-white"
                      } mb-2`}
                    />
                    <span
                      className={`${
                        pairedDevices.length === 0 || !deviceOnline
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
                      size={48}
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
                      size={48}
                      className="text-white mb-2 animate-in zoom-in"
                    />
                    <span className="text-white text-xl font-black">
                      ABIERTO
                    </span>
                  </>
                )}
              </button>

              {/* TARJETAS DE ACCESO RÁPIDO (BOTTOM) */}
              <div className="grid grid-cols-2 gap-4 w-full mt-auto mb-4 px-2">
                {/* TARJETA 1: CONSERJE IA */}
                <div
                  onClick={() => setActiveTab("ai")}
                  className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col cursor-pointer hover:shadow-md transition-all active:scale-95"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div
                      className={`p-2 rounded-xl ${
                        aiEnabled
                          ? "bg-blue-50 text-[#00479b]"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <Bot size={20} />
                    </div>
                    <button
                      onClick={toggleAiState}
                      className={`w-10 h-5 rounded-full transition-all flex items-center p-0.5 ${
                        aiEnabled ? "bg-[#7bc100]" : "bg-slate-300"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow-md transition-all ${
                          aiEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      ></div>
                    </button>
                  </div>
                  <h4 className="font-black text-slate-800 text-sm">
                    Conserje IA
                  </h4>
                  <p
                    className={`text-[10px] font-bold ${
                      aiEnabled ? "text-[#7bc100]" : "text-slate-400"
                    }`}
                  >
                    {aiEnabled ? "Activo ahora" : "Pausado"}
                  </p>
                </div>

                {/* TARJETA 2: VINCULAR DISPOSITIVO */}
                <div
                  onClick={iniciarConexionBluetooth}
                  className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col cursor-pointer hover:shadow-md transition-all active:scale-95 group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 rounded-xl bg-slate-50 text-slate-600 group-hover:bg-[#00479b] group-hover:text-white transition-colors">
                      <Plus size={20} />
                    </div>
                  </div>
                  <h4 className="font-black text-slate-800 text-sm">
                    Añadir Equipo
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400">
                    Vincular nuevo
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500 bg-slate-50 -mx-6 rounded-t-[2.5rem] overflow-hidden border-t border-slate-200">
              <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center shadow-sm z-10 sticky top-0">
                <div>
                  <h2 className="text-sm font-black text-slate-800 flex items-center">
                    <Sparkles size={16} className="mr-1 text-[#00479b]" /> Panel
                    Conserje IA
                  </h2>
                  <p className="text-[10px] font-bold text-slate-500">
                    {aiEnabled
                      ? "Respondiendo visitas automáticamente"
                      : "Pausado. Atención manual."}
                  </p>
                </div>
                <button
                  onClick={toggleAiState}
                  className={`w-12 h-6 rounded-full transition-all flex items-center p-1 ${
                    aiEnabled ? "bg-[#7bc100]" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow-md transition-all ${
                      aiEnabled ? "translate-x-6" : "translate-x-0"
                    }`}
                  ></div>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {!aiEnabled && (
                  <div className="flex justify-center my-4">
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                      Conserje descansando
                    </span>
                  </div>
                )}
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
                    disabled={!aiEnabled}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-xl ${
                      !aiEnabled
                        ? "bg-slate-100 opacity-50 cursor-not-allowed shadow-none"
                        : isFluidMode
                        ? isListening
                          ? "bg-red-500 scale-110 animate-pulse ring-8 ring-red-100"
                          : "bg-amber-400 ring-8 ring-amber-50"
                        : "bg-slate-200 hover:bg-slate-300"
                    }`}
                  >
                    {!aiEnabled ? (
                      <MicOff size={32} className="text-slate-400" />
                    ) : isFluidMode ? (
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
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 py-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  Registro
                </h2>
                <button
                  onClick={handleSummarizeActivity}
                  disabled={isSummarizing || historyLog.length === 0}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-lg transition-all ${
                    historyLog.length === 0
                      ? "bg-slate-200 text-slate-400 shadow-none"
                      : "bg-[#00479b] text-white shadow-blue-900/20 active:scale-95"
                  }`}
                >
                  {isSummarizing ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Sparkles size={12} />
                  )}
                  <span>✨ RESUMIR</span>
                </button>
              </div>
              {activitySummary && (
                <div className="mb-6 bg-blue-50 p-4 rounded-3xl border border-blue-100 animate-in slide-in-from-top-2">
                  <h4 className="text-[10px] font-black text-[#00479b] mb-1 uppercase tracking-widest flex items-center">
                    <FileText size={12} className="mr-1" /> Resumen IA
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {activitySummary}
                  </p>
                  <button
                    onClick={() => setActivitySummary("")}
                    className="mt-2 text-[9px] font-bold text-slate-400 hover:text-slate-600 underline"
                  >
                    Cerrar resumen
                  </button>
                </div>
              )}
              <div className="space-y-3">
                {historyLog.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-400 font-bold text-xs">
                      Aún no hay actividad hoy
                    </p>
                  </div>
                ) : (
                  historyLog.map((log, i) => (
                    <div
                      key={i}
                      className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-3"
                    >
                      <div
                        className={`p-2.5 rounded-xl ${
                          log.type === "ai_open"
                            ? "bg-green-100 text-[#7bc100]"
                            : log.type === "ai_denied"
                            ? "bg-red-100 text-red-500"
                            : log.type === "ai_message"
                            ? "bg-amber-100 text-amber-500"
                            : "bg-blue-100 text-[#00479b]"
                        }`}
                      >
                        {log.type === "ai_open" ? (
                          <Package size={18} />
                        ) : log.type === "ai_denied" ? (
                          <ShieldAlert size={18} />
                        ) : log.type === "ai_message" ? (
                          <MessageSquare size={18} />
                        ) : (
                          <User size={18} />
                        )}
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
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "messages" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 py-4">
              <h2 className="text-xl font-black text-slate-800 mb-6 tracking-tight">
                Recados
              </h2>
              <div className="space-y-4">
                {messagesList.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                    <MessageSquare
                      size={40}
                      className="text-slate-300 mx-auto mb-3"
                    />
                    <p className="text-slate-400 font-bold text-xs">
                      Sin mensajes pendientes
                    </p>
                  </div>
                ) : (
                  messagesList.map((msg, i) => (
                    <div
                      key={i}
                      className="bg-white p-5 rounded-3xl shadow-md border-l-4 border-l-[#7bc100]"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-[8px] font-black text-[#00479b] tracking-tighter uppercase">
                            PARA
                          </span>
                          <h4 className="font-black text-slate-800 text-sm">
                            {msg.recipient}
                          </h4>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400">
                          {msg.time}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mb-4 font-medium italic">
                        "{msg.content}"
                      </p>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleDraftReply(msg)}
                          disabled={draftingId === msg.id}
                          className="flex-1 flex items-center justify-center bg-slate-800 text-white py-2.5 rounded-xl text-[10px] font-black transition-all shadow-lg active:scale-95"
                        >
                          {draftingId === msg.id ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Wand2 size={14} className="mr-2" />
                          )}
                          ✨ REDACTAR
                        </button>
                        <a
                          href={`https://wa.me/${msg.phone.replace(
                            /\D/g,
                            ""
                          )}?text=${encodeURIComponent(
                            `Hola ${msg.recipient}, el Conserje MicroSmart tomó este recado para ti:\n\n"${msg.content}"`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 bg-[#25d366] text-white rounded-xl shadow-lg active:scale-95"
                        >
                          <PhoneForwarded size={16} />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: AJUSTES (SETTINGS)                                   */}
          {/* ========================================================= */}
          {activeTab === "settings" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-5 py-4">
              <h2 className="text-xl font-black text-slate-800 mb-6 tracking-tight">
                Configuración
              </h2>

              {/* MÓDULO IOT: VINCULAR DISPOSITIVOS */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 shadow-lg">
                <div className="flex items-center space-x-3 text-white mb-4">
                  <Smartphone size={18} className="text-[#7bc100]" />
                  <h3 className="font-bold text-sm">Tus Equipos</h3>
                </div>

                {pairedDevices.length > 0 ? (
                  <div className="space-y-3 mb-4">
                    {pairedDevices.map((dev, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl flex justify-between items-center group"
                      >
                        <div>
                          <span className="text-white font-bold text-xs block">
                            {dev}
                          </span>
                          {deviceOnline ? (
                            <span className="text-[#7bc100] text-[9px] font-bold flex items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#7bc100] mr-1"></span>
                              En línea
                            </span>
                          ) : (
                            <span className="text-red-400 text-[9px] font-bold flex items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-1"></span>
                              Desconectado
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveDevice(dev)}
                          className="p-2 text-slate-500 hover:text-red-400 transition-colors hover:bg-slate-700 rounded-lg"
                          title="Eliminar equipo"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-slate-800/50 rounded-xl mb-4 border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold">
                      No hay dispositivos en tu hogar
                    </p>
                  </div>
                )}

                <button
                  onClick={iniciarConexionBluetooth}
                  disabled={isPairing}
                  className="w-full bg-[#00479b] hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl text-xs flex items-center justify-center transition-all shadow-xl active:scale-95"
                >
                  {isPairing ? (
                    <span className="animate-pulse flex items-center">
                      <Bluetooth size={16} className="mr-2" /> Escaneando...
                    </span>
                  ) : (
                    <>
                      <Plus size={16} className="mr-2" /> Añadir otro equipo
                    </>
                  )}
                </button>
              </div>

              {/* MÓDULO USUARIOS AUTORIZADOS */}
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
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg flex items-center px-3">
                      <span className="text-slate-400 text-sm font-bold pr-2 mr-2 border-r border-slate-200">
                        +34
                      </span>
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="Teléfono"
                        className="bg-transparent text-base text-slate-800 w-full py-2.5 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleAddName}
                      className="bg-[#00479b] text-white px-4 rounded-lg text-xs font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
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
