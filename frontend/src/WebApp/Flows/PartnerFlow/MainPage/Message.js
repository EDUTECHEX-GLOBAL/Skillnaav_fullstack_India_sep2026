// Message.js
// ─── Mobile-first chat interface ─────────────────────────────
// • Mobile  : list view → tap → full-screen chat → info button → bottom sheet panel
// • Tablet+ : list sidebar (280px) + chat fills rest; info icon → side panel overlay
// • Desktop : same as tablet; list sidebar stays visible while chatting
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useReducer,
} from "react";
import axios from "../../../../api/axiosInstance";
import { io as ioClient } from "socket.io-client";

import InternshipListView from "./Internshiplistview";
import ChatView from "./Chatview";
import InternshipDetailPanel from "./InternshipDetailPanel";
import {
  resolvePartnerId,
  useDebounce,
  intInitial,
  intReducer,
  msgInitial,
  msgReducer,
  INTERNSHIPS_PER_PAGE,
  MESSAGES_PER_PAGE,
  S,
  globalCss,
  IconNoSession,
} from "./Chatconstants";

const ChatInterface = () => {
  const [partnerId] = useState(resolvePartnerId);

  // ── Internship list ──
  const [intState, intDispatch] = useReducer(intReducer, intInitial);
  const {
    list: internships,
    loading: intLoading,
    searching: intSearching,
    currentPage: intCurrentPage,
    totalPages: intTotalPages,
    totalCount: intTotalCount,
    searchDraft,
    committedQuery,
  } = intState;

  // ── Selected chat ──
  const [showChat, setShowChat] = useState(false);
  const [selected, setSelected] = useState({
    id: null,
    title: "",
    company: "",
    imgUrl: "",
    intType: "",
    intMode: "",
    location: "",
  });

  // ── Detail panel ──
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Messages ──
  const [msgState, msgDispatch] = useReducer(msgReducer, msgInitial);
  const {
    list: messages,
    loading: msgLoading,
    paging: msgPaging,
    currentPage: msgCurrentPage,
    totalPages: msgTotalPages,
    totalCount: msgTotalCount,
  } = msgState;

  // ── Input ──
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);

  // ── Screen size ──
  const [screenW, setScreenW] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setScreenW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const mobile = screenW <= 768;
  const desktop = screenW > 1100;

  // ── Refs ──
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isIntInitialRef = useRef(true);
  const isMsgInitialRef = useRef(true);
  const currentInternRef = useRef(null);

  const debouncedSearch = useDebounce(searchDraft, 400);

  // ─────────────────────────────────────────────────────────
  // Fetch internships
  // ─────────────────────────────────────────────────────────
  const fetchInternships = useCallback(
    async (page, query, isFirst = false) => {
      if (!partnerId) return;
      intDispatch({ type: "FETCH_START", isFirst });
      try {
        const res = await axios.get(`/api/interns/partner/${partnerId}`, {
          params: { page, limit: INTERNSHIPS_PER_PAGE, search: query },
        });
        intDispatch({
          type: "FETCH_SUCCESS",
          data: res.data.data || [],
          totalPages: res.data.totalPages || 1,
          totalCount: res.data.total || 0,
          query,
        });
      } catch (err) {
        console.error("fetchInternships:", err);
        intDispatch({ type: "FETCH_ERROR" });
      }
    },
    [partnerId],
  );

  useEffect(() => {
    if (!partnerId) return;
    fetchInternships(1, "", true);
    isIntInitialRef.current = false;
  }, [partnerId, fetchInternships]);
  useEffect(() => {
    if (isIntInitialRef.current) return;
    fetchInternships(intCurrentPage, committedQuery);
  }, [intCurrentPage, committedQuery, fetchInternships]);
  useEffect(() => {
    if (isIntInitialRef.current) return;
    intDispatch({ type: "SET_PAGE", page: 1 });
    fetchInternships(1, debouncedSearch);
  }, [debouncedSearch, fetchInternships]);

  const handleSearchSubmit = useCallback(() => {
    intDispatch({ type: "SET_PAGE", page: 1 });
    fetchInternships(1, searchDraft);
  }, [searchDraft, fetchInternships]);

  // ─────────────────────────────────────────────────────────
  // Detail panel
  // ─────────────────────────────────────────────────────────
  const fetchInternshipDetail = useCallback(async (internshipId) => {
    if (!internshipId) return;
    setDetailLoading(true);
    try {
      const res = await axios.get(`/api/interns/${internshipId}`);
      setSelectedInternship(res.data?.data || res.data || null);
    } catch (err) {
      console.error("fetchInternshipDetail:", err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // From list — view details without opening chat
  const handleViewDetailsFromList = useCallback(
    async (internship) => {
      const id = internship?._id || internship?.id;
      if (!id) return;
      setSelectedInternship(internship);
      setShowDetailPanel(true);
      await fetchInternshipDetail(id);
    },
    [fetchInternshipDetail],
  );

  // Toggle from chat header info button
  const handleToggleDetailPanel = useCallback(async () => {
    if (showDetailPanel) {
      setShowDetailPanel(false);
      return;
    }
    const id = selected.id;
    if (!id) return;
    setShowDetailPanel(true);
    setDetailLoading(true);
    try {
      const res = await axios.get(`/api/interns/${id}`);
      setSelectedInternship(res.data?.data || res.data || null);
    } catch (err) {
      console.error("handleToggleDetailPanel:", err);
    } finally {
      setDetailLoading(false);
    }
  }, [showDetailPanel, selected.id]);

  const handleCloseDetailPanel = useCallback(() => {
    setShowDetailPanel(false);
    setSelectedInternship(null);
  }, []);

  // ─────────────────────────────────────────────────────────
  // Fetch messages
  // ─────────────────────────────────────────────────────────
  const fetchMessages = useCallback(
    async (page, internshipId, isFirst = false) => {
      if (!partnerId || !internshipId) return;
      msgDispatch({ type: "FETCH_START", isFirst });
      try {
        const res = await axios.get(
          `/api/chats/partner/${partnerId}/internship/${internshipId}`,
          { params: { page, limit: MESSAGES_PER_PAGE } },
        );
        const payload = res.data;
        if (Array.isArray(payload)) {
          msgDispatch({
            type: "FETCH_SUCCESS",
            data: payload,
            totalPages: 1,
            totalCount: payload.length,
          });
        } else {
          msgDispatch({
            type: "FETCH_SUCCESS",
            data: payload.data || [],
            totalPages: payload.totalPages || 1,
            totalCount: payload.total || 0,
          });
        }
        await axios.patch("/api/chats/read", {
          internshipId,
          readerId: partnerId,
        });
      } catch (err) {
        console.error("fetchMessages:", err);
        msgDispatch({ type: "FETCH_ERROR" });
      }
    },
    [partnerId],
  );

  useEffect(() => {
    if (!showChat || !selected.id) return;
    currentInternRef.current = selected.id;
    isMsgInitialRef.current = false;
    fetchMessages(1, selected.id, true);
  }, [showChat, selected.id, fetchMessages]);

  useEffect(() => {
    if (isMsgInitialRef.current) return;
    fetchMessages(msgCurrentPage, currentInternRef.current);
  }, [msgCurrentPage, fetchMessages]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    if (showChat) inputRef.current?.focus();
  }, [showChat]);

  // ─────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────
  const handleInternshipClick = useCallback((id, title, extra = {}) => {
    setSelected({
      id,
      title,
      company: extra.companyName || "",
      imgUrl: extra.imgUrl || "",
      intType: extra.internshipType || "",
      intMode: extra.internshipMode || "",
      location: extra.location || "",
    });
    msgDispatch({ type: "RESET" });
    isMsgInitialRef.current = true;
    setShowDetailPanel(false);
    setSelectedInternship(null);
    setPendingFiles([]);
    setShowChat(true);
  }, []);

  const openInternshipFromNotification = useCallback(
    async (internshipId) => {
      if (!internshipId) return;

      let target = internships.find(
        (item) => String(item._id || item.id) === String(internshipId),
      );

      if (!target) {
        try {
          const res = await axios.get(`/api/interns/${internshipId}`);
          target = res.data?.data || res.data || null;
        } catch (err) {
          console.error("openInternshipFromNotification:", err);
        }
      }

      if (!target) return;

      handleInternshipClick(
        target._id || target.id,
        target.jobTitle || target.title || "Internship",
        {
          companyName: target.companyName || target.company || "",
          imgUrl: target.imgUrl || target.image || target.companyLogo || "",
          internshipType: target.internshipType || target.intType || "",
          internshipMode: target.internshipMode || target.intMode || "",
          location: target.location || "",
        },
      );

      sessionStorage.removeItem("partnerOpenChatInternshipId");
    },
    [internships, handleInternshipClick],
  );

  useEffect(() => {
    openInternshipFromNotification(
      sessionStorage.getItem("partnerOpenChatInternshipId"),
    );

    const handleOpenChatEvent = (event) => {
      openInternshipFromNotification(event?.detail?.internshipId);
    };

    window.addEventListener("partnerOpenInternshipChat", handleOpenChatEvent);
    return () =>
      window.removeEventListener(
        "partnerOpenInternshipChat",
        handleOpenChatEvent,
      );
  }, [openInternshipFromNotification]);

  useEffect(() => {
    if (!partnerId || !showChat || !selected.id) return;

    const SOCKET_URL =
      process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
    const socket = ioClient(SOCKET_URL, { withCredentials: true });

    const joinRooms = () => {
      socket.emit("joinPartnerRoom", { partnerId });
      socket.emit("joinChatRoom", { internshipId: selected.id });
    };

    const handleNewMessage = async (message) => {
      if (String(message?.internship) !== String(selected.id)) return;
      if (String(message?.sender) === String(partnerId)) return;

      msgDispatch({ type: "APPEND", msg: message });
      try {
        await axios.patch("/api/chats/read", {
          internshipId: selected.id,
          readerId: partnerId,
        });
      } catch (err) {
        console.error("markPartnerConversationRead:", err);
      }
    };

    const handleMessageDeleted = () => fetchMessages(1, selected.id, true);

    socket.on("connect", joinRooms);
    socket.on("newMessage", handleNewMessage);
    socket.on("messageDeleted", handleMessageDeleted);

    return () => {
      socket.emit("leaveChatRoom", { internshipId: selected.id });
      socket.off("connect", joinRooms);
      socket.off("newMessage", handleNewMessage);
      socket.off("messageDeleted", handleMessageDeleted);
      socket.disconnect();
    };
  }, [partnerId, showChat, selected.id, fetchMessages]);

  const handleBackToList = useCallback(() => {
    setShowChat(false);
    msgDispatch({ type: "RESET" });
    isMsgInitialRef.current = true;
    setShowDetailPanel(false);
    setSelectedInternship(null);
    setPendingFiles([]);
  }, []);

  const handleMsgPageChange = useCallback(
    (page) => msgDispatch({ type: "SET_PAGE", page }),
    [],
  );
  const handleFilesSelected = useCallback(
    (newFiles) => setPendingFiles((prev) => [...prev, ...newFiles]),
    [],
  );
  const handleRemoveFile = useCallback(
    (idx) => setPendingFiles((prev) => prev.filter((_, i) => i !== idx)),
    [],
  );

  // ─── Send ──────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const hasText = input.trim();
    const hasFiles = pendingFiles.length > 0;
    if ((!hasText && !hasFiles) || !partnerId || !selected.id || sending)
      return;

    const text = hasText ? input.trim() : "";
    const filesToSend = [...pendingFiles];

    setInput("");
    setPendingFiles([]);
    setSending(true);
    setIsTyping(true);

    const optimistic = {
      _id: `temp-${Date.now()}`,
      message: text,
      sender: partnerId,
      internship: selected.id,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      files: filesToSend.map((f) => ({
        originalName: f.name,
        mimeType: f.type,
        size: f.size,
        url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      })),
    };
    msgDispatch({ type: "APPEND", msg: optimistic });

    try {
      let res;
      if (filesToSend.length > 0) {
        const uploadedFiles = [];
        for (const file of filesToSend) {
          const fd = new FormData();
          fd.append("file", file);
          const uploadRes = await axios.post("/api/chats/upload", fd);
          uploadedFiles.push(uploadRes.data);
        }
        for (let i = 0; i < uploadedFiles.length; i++) {
          const fileData = uploadedFiles[i];
          res = await axios.post("/api/chats/send", {
            internshipId: selected.id,
            senderId: partnerId,
            message: i === 0 ? text : "",
            fileUrl: fileData.fileUrl,
            fileName: fileData.fileName,
            fileType: fileData.fileType,
            fileSize: fileData.fileSize,
          });
        }
      } else {
        res = await axios.post("/api/chats/send", {
          internshipId: selected.id,
          senderId: partnerId,
          message: text,
        });
      }
      msgDispatch({ type: "REPLACE_LAST", msg: res.data });
    } catch (err) {
      console.error("sendMessage:", err);
      msgDispatch({ type: "REMOVE", id: optimistic._id });
      setInput(text);
      setPendingFiles(filesToSend);
    } finally {
      setSending(false);
      setTimeout(() => setIsTyping(false), 400);
    }
  }, [input, pendingFiles, partnerId, selected.id, sending]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ─────────────────────────────────────────────────────────
  // No session
  // ─────────────────────────────────────────────────────────
  if (!partnerId) {
    return (
      <>
        <style>{globalCss}</style>
        <div style={S.noSession}>
          <div
            style={{
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 22,
              padding: "30px 24px",
              width: "min(92%, 420px)",
              boxShadow: "0 20px 44px rgba(15,23,42,0.06)",
              textAlign: "center",
            }}
          >
            <div style={S.noSessionIcon}>{IconNoSession}</div>
            <h2
              style={{
                margin: 0,
                fontSize: 21,
                fontWeight: 800,
                color: "#0F172A",
              }}
            >
              Session not found
            </h2>
            <p
              style={{
                margin: "10px 0 0",
                color: "#64748B",
                lineHeight: 1.7,
                fontSize: 13.5,
              }}
            >
              We couldn't detect your partner session. Please log in again and
              reopen the messaging page.
            </p>
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <>
      <style>{globalCss}</style>

      <div style={S.appShell}>
        {showChat ? (
          /* ── CHAT VIEW ────────────────────────────────────────────── */
          <div style={{ ...S.rowFull }}>
            {/* Sidebar: hidden on mobile, visible on tablet/desktop */}
            {!mobile && (
              <div style={{ ...S.sidebarWrap, width: desktop ? 300 : 260 }}>
                <InternshipListView
                  internships={internships}
                  intLoading={intLoading}
                  intSearching={intSearching}
                  intCurrentPage={intCurrentPage}
                  intTotalPages={intTotalPages}
                  intTotalCount={intTotalCount}
                  searchDraft={searchDraft}
                  committedQuery={committedQuery}
                  selectedId={selected.id}
                  onSearchDraftChange={(v) =>
                    intDispatch({ type: "SET_DRAFT", value: v })
                  }
                  onSearchSubmit={handleSearchSubmit}
                  onPageChange={(page) =>
                    intDispatch({ type: "SET_PAGE", page })
                  }
                  onInternshipClick={handleInternshipClick}
                  onViewDetails={handleViewDetailsFromList}
                />
              </div>
            )}

            {/* Chat column */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <ChatView
                selected={selected}
                partnerId={partnerId}
                messages={messages}
                msgLoading={msgLoading}
                msgPaging={msgPaging}
                msgCurrentPage={msgCurrentPage}
                msgTotalPages={msgTotalPages}
                msgTotalCount={msgTotalCount}
                isTyping={isTyping}
                sending={sending}
                input={input}
                inputRef={inputRef}
                messagesEndRef={messagesEndRef}
                showDetailPanel={showDetailPanel}
                pendingFiles={pendingFiles}
                onBack={handleBackToList}
                onMsgPageChange={handleMsgPageChange}
                onSend={handleSend}
                onKeyDown={handleKeyDown}
                onInputChange={setInput}
                onToggleDetail={handleToggleDetailPanel}
                onFilesSelected={handleFilesSelected}
                onRemoveFile={handleRemoveFile}
              />
            </div>

            {/* Detail panel — universal bottom-sheet / side-panel overlay */}
            {showDetailPanel && (
              <InternshipDetailPanel
                open={showDetailPanel}
                item={selectedInternship}
                loading={detailLoading}
                onClose={handleCloseDetailPanel}
              />
            )}
          </div>
        ) : (
          /* ── LIST VIEW ───────────────────────────────────────────── */
          <div
            style={{
              display: "flex",
              height: "100%",
              width: "100%",
              overflow: "hidden",
            }}
          >
            {/* Internship list — always full width on mobile */}
            <div
              style={{
                width: showDetailPanel && !mobile ? 300 : "100%",
                minWidth: showDetailPanel && !mobile ? 260 : "100%",
                maxWidth: showDetailPanel && !mobile ? 320 : "100%",
                flexShrink: 0,
                height: "100%",
                background: "#fff",
                borderRight:
                  showDetailPanel && !mobile ? "1px solid #EAECF4" : "none",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                transition: "width 0.18s ease",
              }}
            >
              <InternshipListView
                internships={internships}
                intLoading={intLoading}
                intSearching={intSearching}
                intCurrentPage={intCurrentPage}
                intTotalPages={intTotalPages}
                intTotalCount={intTotalCount}
                searchDraft={searchDraft}
                committedQuery={committedQuery}
                selectedId={null}
                onSearchDraftChange={(v) =>
                  intDispatch({ type: "SET_DRAFT", value: v })
                }
                onSearchSubmit={handleSearchSubmit}
                onPageChange={(page) => intDispatch({ type: "SET_PAGE", page })}
                onInternshipClick={handleInternshipClick}
                onViewDetails={handleViewDetailsFromList}
              />
            </div>

            {/* Detail panel (desktop inline column) */}
            {showDetailPanel && !mobile && (
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  overflow: "hidden",
                  display: "flex",
                  background: "#fff",
                }}
              >
                <InternshipDetailPanel
                  open={showDetailPanel}
                  item={selectedInternship}
                  loading={detailLoading}
                  onClose={handleCloseDetailPanel}
                />
              </div>
            )}

            {/* Detail panel (mobile: full bottom-sheet overlay) */}
            {showDetailPanel && mobile && (
              <InternshipDetailPanel
                open={showDetailPanel}
                item={selectedInternship}
                loading={detailLoading}
                onClose={handleCloseDetailPanel}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default ChatInterface;
