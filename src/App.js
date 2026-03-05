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
} from "lucide-react";

// Implementación de Backoff Exponencial para las llamadas a la API
const fetchWithRetry = async (url, options, retries = 5, delay = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
};

/**
 * COMPONENTE DEL LOGO:
 * Asegúrate de que tu imagen en la carpeta 'public' se llame 'logo.png'
 */
const MicroSmartLogo = ({ className }) => (
  <div className={className}>
    <img
      src="/logo.png"
      alt="MicroSmart Logo"
      className="h-full w-auto object-contain"
      onError={(e) => {
        // Respaldo si la imagen no carga
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
    { name: "Carlos García", phone: "+34 600 111 222" },
    { name: "María López", phone: "+34 600 333 444" },
  ]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [historyLog, setHistoryLog] = useState([
    {
      id: 1,
      type: "manual",
      title: "Apertura Manual",
      desc: "Carlos García (Tú)",
      time: "09:00",
      date: "Hoy",
    },
  ]);
  const [messagesList, setMessagesList] = useState([]);

  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      role: "ai",
      content:
        "Hola, soy el conserje de MicroSmart. ¿Con quién hablo y en qué le puedo ayudar?",
    },
  ]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping]);

  const handleAddName = () => {
    if (
      newName.trim() &&
      newPhone.trim() &&
      !authorizedNames
        .map((n) => n.name.toLowerCase())
        .includes(newName.trim().toLowerCase())
    ) {
      const formattedPhone = newPhone.startsWith("+")
        ? newPhone.trim()
        : `+34 ${newPhone.trim()}`;
      setAuthorizedNames([
        ...authorizedNames,
        { name: newName.trim(), phone: formattedPhone },
      ]);
      setNewName("");
      setNewPhone("");
    }
  };

  const handleRemoveName = (nameToRemove) => {
    setAuthorizedNames(
      authorizedNames.filter((person) => person.name !== nameToRemove)
    );
  };

  const handleOpenDoor = () => {
    if (doorStatus !== "idle") return;
    setDoorStatus("opening");

    setTimeout(() => {
      setDoorStatus("opened");
      setHistoryLog((prev) => [
        {
          id: Date.now(),
          type: "manual",
          title: "Apertura Manual",
          desc: "Realizado desde la App",
          time: getCurrentTime(),
          date: "Hoy",
        },
        ...prev,
      ]);

      setTimeout(() => {
        setDoorStatus("idle");
      }, 2000);
    }, 1500);
  };

  const handleSimulateVisitor = async () => {
    if (!chatInput.trim() || isTyping) return;

    const newUserMsg = { role: "user", content: chatInput };
    setChatHistory((prev) => [...prev, newUserMsg]);
    setChatInput("");
    setIsTyping(true);

    const apiKey = "";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    const allowedNamesList =
      authorizedNames.length > 0
        ? authorizedNames.map((p) => p.name).join(", ")
        : "Nadie";

    const systemPrompt = `Eres el conserje virtual de alta seguridad de una vivienda, creado por MicroSmart.
Tu PERSONALIDAD: Amable, natural y educado. Mantén un tono formal y eficiente pero agradable.

REGLAS DE SEGURIDAD CRÍTICAS:
1. NUNCA confirmes apellidos o nombres que el visitante NO haya dicho primero.
2. El visitante DEBE dar NOMBRE Y APELLIDO EXACTO de la persona que busca. Si solo dicen el nombre de pila, pregunta el apellido.
3. NUNCA digas que la casa está vacía. Si el nombre no coincide, indica que se han equivocado de casa.

PERSONAS AUTORIZADAS: [${allowedNamesList}].

PROTOCOLO:
- REPARTIDOR: Debe decir EMPRESA y NOMBRE COMPLETO del destinatario. Si es correcto, dile: "Le abro la puerta, por favor ingrese y deje el paquete en un sitio seguro y al salir cierre bien la puerta". Etiqueta: [ABRIR_PUERTA | Empresa | Destinatario]
- VISITA: Si valida el nombre completo y la persona no está, ofrece tomar recado. Etiqueta: [MENSAJE_PARA | NombreAutorizado | texto]
- RECHAZO: Si es comercial o error de nombre, rechaza educadamente. Etiqueta: [ACCESO_DENEGADO | Motivo]`;

    const contents = [
      ...chatHistory.filter((m) => m.role !== "system"),
      newUserMsg,
    ].map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: contents,
    };

    try {
      const data = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let aiText =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Error al procesar la respuesta.";

      let actionType = null;
      const currentTime = getCurrentTime();

      if (aiText.includes("[ABRIR_PUERTA")) {
        actionType = "opened";
        let company = "Desconocida";
        let recipient = "Desconocido";
        const openMatch = aiText.match(
          /\[ABRIR_PUERTA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/i
        );
        if (openMatch) {
          company = openMatch[1].trim();
          recipient = openMatch[2].trim();
        }
        setDoorStatus("opening");
        setTimeout(() => setDoorStatus("opened"), 1500);
        setTimeout(() => setDoorStatus("idle"), 3500);
        setHistoryLog((prev) => [
          {
            id: Date.now(),
            type: "ai_open",
            title: "Apertura Inteligente",
            desc: `${company} entregó a ${recipient}`,
            time: currentTime,
            date: "Hoy",
          },
          ...prev,
        ]);
      } else if (aiText.includes("[MENSAJE_PARA")) {
        actionType = "message_saved";
        let recipient = "Desconocido";
        let content = "Recado grabado";
        const msgMatch = aiText.match(
          /\[MENSAJE_PARA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/i
        );
        if (msgMatch) {
          recipient = msgMatch[1].trim();
          content = msgMatch[2].trim();
        }
        const matchedPerson = authorizedNames.find(
          (p) => p.name.toLowerCase() === recipient.toLowerCase()
        );
        const phone = matchedPerson ? matchedPerson.phone : "Desconocido";
        setMessagesList((prev) => [
          {
            id: Date.now(),
            recipient,
            phone,
            content,
            time: currentTime,
            date: "Hoy",
            autoSent: true,
          },
          ...prev,
        ]);
        setHistoryLog((prev) => [
          {
            id: Date.now(),
            type: "message",
            title: "Nuevo Recado",
            desc: `Dejado para ${recipient}`,
            time: currentTime,
            date: "Hoy",
          },
          ...prev,
        ]);
      } else if (aiText.includes("[ACCESO_DENEGADO")) {
        actionType = "denied";
        let reason = "Filtro de seguridad";
        const denyMatch = aiText.match(/\[ACCESO_DENEGADO\s*\|\s*(.*?)\]/i);
        if (denyMatch) reason = denyMatch[1].trim();
        setHistoryLog((prev) => [
          {
            id: Date.now(),
            type: "denied",
            title: "Acceso Denegado",
            desc: reason,
            time: currentTime,
            date: "Hoy",
          },
          ...prev,
        ]);
      }

      aiText = aiText.replace(/\[.*?\]/g, "").trim();
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: aiText, action: actionType },
      ]);
    } catch (error) {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: "Lo siento, hay un problema técnico temporal." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f3f4f6] p-4 font-sans text-slate-900">
      <div className="w-full max-w-md h-[840px] max-h-[92vh] bg-white rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col relative border-[10px] border-[#1e293b]">
        {/* Notch superior */}
        <div className="h-6 w-1/3 bg-[#1e293b] absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl z-30"></div>

        {/* Cabecera con Logo */}
        <div className="bg-white px-6 pt-12 pb-4 flex flex-col z-10">
          <div className="flex justify-between items-center mb-6">
            {/* Aumentado de h-10 a h-16 para que el logo sea más grande */}
            <MicroSmartLogo className="h-16 w-auto flex items-center" />
            <div className="flex space-x-2">
              <button className="p-2 hover:bg-slate-100 rounded-full transition-colors relative">
                <Bell size={20} className="text-slate-600" />
                {messagesList.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Menu size={20} className="text-slate-600" />
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="w-12 h-12 bg-[#00479b] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/10">
              <User size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">
                Hola, {authorizedNames[0]?.name?.split(" ")[0]}
              </h1>
              <p className="text-xs text-slate-500 font-medium flex items-center">
                <MapPin size={12} className="mr-1 text-[#7bc100]" />{" "}
                microsmart.es
              </p>
            </div>
          </div>
        </div>

        {/* Área de Contenido Principal */}
        <div className="flex-1 overflow-y-auto pb-28 px-6 pt-2">
          {activeTab === "home" && (
            <div className="flex flex-col items-center space-y-10 py-10 animate-in fade-in zoom-in duration-500">
              <div className="text-center">
                <div
                  className={`inline-flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    doorStatus === "idle"
                      ? "bg-green-50 text-green-600"
                      : "bg-blue-50 text-blue-600"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      doorStatus === "idle"
                        ? "bg-green-500"
                        : "bg-blue-500 animate-pulse"
                    }`}
                  ></div>
                  <span>SISTEMA ONLINE</span>
                </div>
              </div>

              <div className="relative group">
                {doorStatus === "opening" && (
                  <div className="absolute inset-0 bg-[#00479b]/20 rounded-full animate-ping"></div>
                )}
                <button
                  onClick={handleOpenDoor}
                  disabled={doorStatus !== "idle"}
                  className={`relative w-64 h-64 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 ${
                    doorStatus === "idle"
                      ? "bg-gradient-to-tr from-[#6aa600] to-[#8be000] shadow-[#7bc100]/30 hover:shadow-[#7bc100]/50"
                      : "bg-[#00479b] shadow-blue-900/30"
                  }`}
                >
                  <div className="absolute inset-3 rounded-full border-2 border-white/20"></div>
                  {doorStatus === "idle" ? (
                    <>
                      <Power
                        size={64}
                        className="text-white mb-2 drop-shadow-lg"
                      />
                      <span className="text-white text-2xl font-black tracking-tighter">
                        ABRIR
                      </span>
                      <span className="text-white/70 text-[10px] font-bold mt-1">
                        PULSA PARA ACTIVAR
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck
                        size={64}
                        className="text-white mb-2 animate-bounce"
                      />
                      <span className="text-white text-xl font-bold">
                        PROCESANDO
                      </span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center">
                  <span className="text-2xl font-black text-slate-800">
                    {historyLog.length}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                    Registros
                  </span>
                </div>
                <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center">
                  <span className="text-2xl font-black text-slate-800">
                    {messagesList.length}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                    Avisos
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500 bg-slate-50 -mx-6 rounded-t-[3rem] overflow-hidden border-t border-slate-200">
              <div className="p-6 pb-2">
                <h2 className="text-xl font-black text-slate-800 flex items-center">
                  <Sparkles size={20} className="mr-2 text-[#00479b]" />{" "}
                  Conserje IA
                </h2>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                  Simulador de telefonillo
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-3xl text-sm leading-relaxed shadow-sm ${
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
                    <div className="bg-white border border-slate-100 px-4 py-3 rounded-3xl rounded-bl-none shadow-sm flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                      <div
                        className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 bg-white border-t border-slate-100">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleSimulateVisitor()
                    }
                    placeholder="Escribe como si fueras la visita..."
                    className="w-full bg-slate-50 text-sm text-slate-800 rounded-2xl pl-4 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-[#7bc100]/20 border border-slate-100"
                  />
                  <button
                    onClick={handleSimulateVisitor}
                    disabled={isTyping || !chatInput.trim()}
                    className="absolute right-2 p-2.5 bg-[#00479b] text-white rounded-xl hover:bg-blue-800 disabled:opacity-30 transition-all shadow-lg shadow-blue-900/20"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-black text-slate-800 mb-6 tracking-tight">
                Actividad
              </h2>
              <div className="space-y-4">
                {historyLog.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center space-x-4"
                  >
                    <div
                      className={`p-3 rounded-2xl ${
                        log.type === "ai_open"
                          ? "bg-green-100 text-[#7bc100]"
                          : log.type === "manual"
                          ? "bg-blue-100 text-[#00479b]"
                          : log.type === "message"
                          ? "bg-purple-100 text-purple-600"
                          : "bg-red-100 text-red-500"
                      }`}
                    >
                      {log.type === "ai_open" ? (
                        <Package size={20} />
                      ) : log.type === "manual" ? (
                        <User size={20} />
                      ) : log.type === "message" ? (
                        <MessageSquare size={20} />
                      ) : (
                        <ShieldAlert size={20} />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800 text-sm leading-none mb-1">
                        {log.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {log.desc}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-slate-700 block">
                        {log.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "messages" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-black text-slate-800 mb-6 tracking-tight">
                Recados
              </h2>
              <div className="space-y-4">
                {messagesList.length === 0 ? (
                  <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                    <MessageSquare
                      size={48}
                      className="text-slate-300 mx-auto mb-4"
                    />
                    <p className="text-slate-400 font-bold text-sm">
                      Sin mensajes pendientes
                    </p>
                  </div>
                ) : (
                  messagesList.map((msg) => (
                    <div
                      key={msg.id}
                      className="bg-white p-6 rounded-[2.5rem] shadow-md border-l-4 border-l-[#7bc100]"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-[9px] font-black text-[#00479b] tracking-tighter uppercase">
                            PARA
                          </span>
                          <h4 className="font-black text-slate-800 text-base">
                            {msg.recipient}
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                          {msg.time}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-4 font-medium italic">
                        "{msg.content}"
                      </p>
                      <a
                        href={`https://wa.me/${msg.phone.replace(
                          /\D/g,
                          ""
                        )}?text=${encodeURIComponent(
                          `Hola ${msg.recipient}, el Conserje MicroSmart tomó este recado para ti:\n\n"${msg.content}"`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-full bg-[#25d366] hover:bg-[#128c7e] text-white py-3 rounded-2xl text-xs font-black transition-all shadow-lg shadow-green-500/20"
                      >
                        <PhoneForwarded size={16} className="mr-2" /> REENVIAR
                        WHATSAPP
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
              <h2 className="text-2xl font-black text-slate-800 mb-6 tracking-tight">
                Configuración
              </h2>

              <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
                <div className="flex items-center space-x-3 mb-4">
                  <UserPlus size={20} className="text-[#00479b]" />
                  <h3 className="font-bold text-slate-800">
                    Personas Autorizadas
                  </h3>
                </div>

                <div className="space-y-3 mb-6">
                  {authorizedNames.map((person, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100"
                    >
                      <div>
                        <span className="text-sm font-bold text-slate-700 block">
                          {person.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          {person.phone}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveName(person.name)}
                        className="text-red-400 p-2 hover:bg-red-50 rounded-xl"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#7bc100]/20"
                  />
                  <div className="flex space-x-2">
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl flex items-center px-4">
                      <span className="text-slate-400 text-sm font-bold border-r border-slate-200 pr-3 mr-3">
                        +34
                      </span>
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="Teléfono"
                        className="bg-transparent text-sm w-full py-3 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleAddName}
                      className="bg-[#00479b] text-white px-6 rounded-xl font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 space-y-2">
                <button className="w-full flex justify-between items-center p-3 hover:bg-slate-50 rounded-2xl transition-all">
                  <div className="flex items-center space-x-3">
                    <Wifi size={20} className="text-slate-400" />
                    <span className="text-sm font-bold text-slate-700">
                      Configurar WiFi
                    </span>
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </button>
                <button className="w-full flex justify-between items-center p-3 hover:bg-red-50 rounded-2xl transition-all text-red-500">
                  <div className="flex items-center space-x-3">
                    <LogOut size={20} />
                    <span className="text-sm font-bold">Desconectar App</span>
                  </div>
                </button>
              </div>

              <div className="text-center pt-4">
                <p className="text-[10px] font-black text-[#00479b] tracking-[0.2em]">
                  MICROSMART.ES
                </p>
                <p className="text-[9px] text-slate-300 font-bold mt-1 uppercase">
                  Control Inteligente v1.2
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Menú Inferior Estilo Dock */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-white/90 backdrop-blur-xl border border-white/50 px-4 py-3 flex justify-between items-center z-20 rounded-[2.5rem] shadow-2xl">
          <NavItem
            active={activeTab === "home"}
            onClick={() => setActiveTab("home")}
            icon={<Home size={24} />}
            label="Inicio"
          />
          <NavItem
            active={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            icon={<Clock size={24} />}
            label="Registro"
          />
          <NavItem
            active={activeTab === "messages"}
            onClick={() => setActiveTab("messages")}
            icon={<MessageSquare size={24} />}
            label="Recados"
            badge={messagesList.length}
          />
          <NavItem
            active={activeTab === "ai"}
            onClick={() => setActiveTab("ai")}
            icon={<Bot size={24} />}
            label="IA"
          />
          <NavItem
            active={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
            icon={<Settings size={24} />}
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
      className={`relative flex flex-col items-center justify-center p-2 transition-all duration-300 ${
        active ? "text-[#00479b]" : "text-slate-400 hover:text-slate-600"
      }`}
    >
      <div
        className={`transition-all duration-300 ${
          active ? "scale-110 -translate-y-1" : "scale-100"
        }`}
      >
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white">
            {badge}
          </span>
        )}
      </div>
      <span
        className={`text-[8px] font-black uppercase tracking-tighter mt-1 transition-all ${
          active ? "opacity-100" : "opacity-0 h-0"
        }`}
      >
        {label}
      </span>
      {active && (
        <div className="absolute -bottom-1 w-1 h-1 bg-[#00479b] rounded-full"></div>
      )}
    </button>
  );
}
