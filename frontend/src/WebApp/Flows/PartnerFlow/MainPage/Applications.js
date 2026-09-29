//File: Applications.js

import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "../../../../api/axiosInstance";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMapMarkerAlt,
  faClock,
  faDollarSign,
  faEye,
  faStar,
  faDownload,
  faLock,
  faCrown,
  faTimes,
  faCalendarAlt,
  faSearch,
  faBriefcase,
  faChevronDown,
  faChevronUp,
  faUserCheck,
} from "@fortawesome/free-solid-svg-icons";
import Modal from "./Modal";
import ScheduleForm from "./ScheduleForm";
import { ApplicationsTable, ShortlistedTable } from "./Tables";
import { toast } from "react-toastify";
import ConfirmCloseSchedule from "./ConfirmCloseSchedule";
import InternshipScheduleViewer from "./InternshipScheduleViewer";
import AttendanceDashboard from "./AttendanceDashboard";
import TimeSlotsSelected from "./TimeSlotsSelected";

const AI_API = "/api/ai";
const CLOSE_SCHEDULE_TEMPLATES_PER_PAGE = 12;

const getDefaultCloseScheduleModalState = () => ({
  open: false,
  internshipId: null,
  step: "confirm",
  title: "Close Internship Schedule",
  message:
    "Are you sure that you want to close the current internship schedule?",
  confirmLabel: "Yes",
  cancelLabel: "No",
  hideConfirm: false,
  templates: [],
  selectedTemplateId: null,
  templateSearchQuery: "",
  templatePage: 1,
  isLoadingTemplates: false,
  isSubmitting: false,
});

// ─── Type badge ───────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const cfg = {
    PAID: {
      cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
      label: "Paid",
    },
    STIPEND: {
      cls: "bg-blue-100 text-blue-700 border-blue-200",
      label: "Stipend",
    },
    FREE: { cls: "bg-gray-100 text-gray-500 border-gray-200", label: "Free" },
  }[(type || "").toUpperCase()] || {
    cls: "bg-gray-100 text-gray-500 border-gray-200",
    label: type,
  };

  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
};

const InternshipList = () => {
  const [internships, setInternships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [partnerData, setPartnerData] = useState(null);

  const [applications, setApplications] = useState({});
  const [loadingApplications, setLoadingApplications] = useState({});
  const [shortlistedCandidates, setShortlistedCandidates] = useState({});
  const [loadingShortlist, setLoadingShortlist] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [modalData, setModalData] = useState({
    open: false,
    internshipId: null,
    type: null,
    loading: false,
  });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef(null);

  const [descExpanded, setDescExpanded] = useState({});
  const [qualExpanded, setQualExpanded] = useState({});

  const partnerIdRef = useRef(null);
  const closeScheduleTemplatesCacheRef = useRef({
    partnerId: null,
    items: [],
    loaded: false,
  });
  const closeScheduleTemplatesRequestRef = useRef({
    partnerId: null,
    promise: null,
  });

  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [selectedInternshipForSchedule, setSelectedInternshipForSchedule] =
    useState(null);
  const [atsModalOpen, setAtsModalOpen] = useState(false);
  const [atsThreshold, setAtsThreshold] = useState(30);
  const [pendingShortlistInternship, setPendingShortlistInternship] =
    useState(null);
  const [closeScheduleModal, setCloseScheduleModal] = useState(
    getDefaultCloseScheduleModalState,
  );
  const [scheduleViewerOpen, setScheduleViewerOpen] = useState(false);
  const [selectedInternshipForView, setSelectedInternshipForView] =
    useState(null);
  const [attendanceDashboardOpen, setAttendanceDashboardOpen] = useState(false);
  const [selectedInternshipForAttendance, setSelectedInternshipForAttendance] =
    useState(null);
  const [timeSlotsModal, setTimeSlotsModal] = useState({
    open: false,
    internshipId: null,
  });

  // ─── Filter state ────────────────────────────────────────────────────────────
  const [filterType, setFilterType] = useState("All Types");
  const [filterMode, setFilterMode] = useState("All Modes");
  const [filterLevel, setFilterLevel] = useState("All Levels");

  // ─── Fetch internships ───────────────────────────────────────────────────────
  const fetchInternships = useCallback(
    async (
      pid,
      pageNum = 1,
      query = "",
      isInitialLoad = false,
      type = "All Types",
      mode = "All Modes",
      level = "All Levels",
    ) => {
      if (!pid) return;
      if (isInitialLoad) setLoading(true);
      else setIsSearching(true);
      if (pageNum > 1) setLoadingMore(true);
      setError(null);

      try {
        const params = { page: pageNum, limit: 6 };
        if (query.trim()) params.search = query.trim();
        if (type !== "All Types") params.internshipType = type.toUpperCase();
        if (mode !== "All Modes") params.internshipMode = mode.toUpperCase();
        if (level !== "All Levels") params.classification = level;

        const response = await axios.get(`/api/interns/partner/${pid}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          params,
        });

        setInternships(response.data.data || []);
        setPage(pageNum);
        setTotalPages(Number(response.data.totalPages) || 1);
        setTotalCount(Number(response.data.total) || 0);
        setHasMore(pageNum < (Number(response.data.totalPages) || 1));
        setDebouncedQuery(query || "");
      } catch (err) {
        console.error("Error fetching internships:", err);
        if (isInitialLoad || pageNum === 1) {
          setInternships([]);
          setError("Failed to load internships. Please try again.");
        } else {
          toast.error("Failed to load page. Please try again.");
        }
      } finally {
        setLoading(false);
        setIsSearching(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    const fetchPartnerData = async () => {
      try {
        const response = await axios.get(`/api/partners/profile`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setPartnerData(response.data);
        if (response.data?._id) {
          partnerIdRef.current = response.data._id;
          fetchInternships(response.data._id, 1, "", true);
        } else throw new Error("Partner ID not found in profile");
      } catch (err) {
        console.error("Failed to fetch partner data:", err);
        setError("Unable to load partner profile");
        setLoading(false);
      }
    };
    fetchPartnerData();
  }, [fetchInternships]);

  const getCachedCloseScheduleTemplates = useCallback((partnerId) => {
    if (!partnerId) {
      return { items: [], loaded: false };
    }

    const cache = closeScheduleTemplatesCacheRef.current;
    if (cache.partnerId !== partnerId) {
      return { items: [], loaded: false };
    }

    return {
      items: Array.isArray(cache.items) ? cache.items : [],
      loaded: Boolean(cache.loaded),
    };
  }, []);

  const fetchCloseScheduleTemplates = useCallback(
    async (partnerId) => {
      if (!partnerId) return [];

      const cached = getCachedCloseScheduleTemplates(partnerId);
      if (cached.loaded) {
        return cached.items;
      }

      if (
        closeScheduleTemplatesRequestRef.current.partnerId === partnerId &&
        closeScheduleTemplatesRequestRef.current.promise
      ) {
        return closeScheduleTemplatesRequestRef.current.promise;
      }

      const requestPromise = axios
        .get(`/api/custom-internship-certificates/${partnerId}`)
        .then((response) => {
          const items = Array.isArray(response.data?.items)
            ? response.data.items.filter((item) => item.status === "Approved")
            : [];

          closeScheduleTemplatesCacheRef.current = {
            partnerId,
            items,
            loaded: true,
          };

          return items;
        });

      closeScheduleTemplatesRequestRef.current = {
        partnerId,
        promise: requestPromise,
      };

      try {
        return await requestPromise;
      } finally {
        if (
          closeScheduleTemplatesRequestRef.current.promise === requestPromise
        ) {
          closeScheduleTemplatesRequestRef.current = {
            partnerId: null,
            promise: null,
          };
        }
      }
    },
    [getCachedCloseScheduleTemplates],
  );

  useEffect(() => {
    const partnerId = partnerData?._id || localStorage.getItem("partnerId");
    if (!partnerId) return;

    fetchCloseScheduleTemplates(partnerId).catch(() => {});
  }, [partnerData, fetchCloseScheduleTemplates]);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (partnerIdRef.current) fetchInternships(partnerIdRef.current, 1, q);
    }, 350);
  };

  const toggleApplicationOpen = async (internshipId, newStatus) => {
    const internship = internships.find((i) => i._id === internshipId);
    if (internship && internship.isScheduleClosed && newStatus === true) {
      setCloseScheduleModal({
        ...getDefaultCloseScheduleModalState(),
        open: true,
        internshipId: null,
        title: "Schedule Is Closed",
        message:
          "Cannot open applications because the internship schedule is already closed.",
        confirmLabel: "Yes",
        cancelLabel: "OK",
        hideConfirm: true,
      });
      return;
    }

    try {
      setInternships((prev) =>
        prev.map((i) =>
          i._id === internshipId ? { ...i, applicationOpen: newStatus } : i,
        ),
      );
      await axios.put(
        `/api/interns/${internshipId}`,
        { applicationOpen: newStatus },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      toast.success(`Applications are now ${newStatus ? "open" : "closed"}.`);
    } catch {
      toast.error("Failed to update. Please try again.");
      setInternships((prev) =>
        prev.map((i) =>
          i._id === internshipId ? { ...i, applicationOpen: !newStatus } : i,
        ),
      );
    }
  };

  const hasPremiumAccess = () => {
    const plan = partnerData?.planType?.trim().toLowerCase();
    return (
      partnerData?.isPremium &&
      (plan === "premium basic" || plan === "premium plus")
    );
  };

  const hasFullPremiumAccess = () => {
    const plan = partnerData?.planType?.trim().toLowerCase();
    return partnerData?.isPremium && plan === "premium plus";
  };

  const calculateDaysAgo = (date) => {
    const diff = Date.now() - new Date(date);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    if (days === 0) return hours === 0 ? "Just now" : `${hours}h ago`;
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  };

  const getPricingBucketFromInternship = (internship) => {
    const raw = String(internship?.internshipType || "")
      .trim()
      .toUpperCase();
    if (raw === "PAID") return "paid";
    if (raw === "STIPEND") return "stipend";
    return "free";
  };

  const fetchApplications = async (internshipId) => {
    if (!hasPremiumAccess()) {
      toast.error("Upgrade to Premium Basic or higher to view applications");
      return;
    }
    try {
      setLoadingApplications((prev) => ({ ...prev, [internshipId]: true }));
      setModalData({
        open: true,
        internshipId,
        type: "applications",
        loading: true,
      });
      const { data } = await axios.get(
        `/api/applications/internship/${internshipId}`,
      );
      setApplications((prev) => ({
        ...prev,
        [internshipId]: Array.isArray(data.applications)
          ? data.applications
          : [],
      }));
    } catch (err) {
      setApplications((prev) => ({ ...prev, [internshipId]: [] }));
      toast.error("Failed to load applications.");
    } finally {
      setLoadingApplications((prev) => ({ ...prev, [internshipId]: false }));
      setModalData((prev) => ({ ...prev, loading: false }));
    }
  };

  // Opens the ATS threshold modal before running shortlist
  const openAtsModal = (internship) => {
    if (!hasPremiumAccess()) {
      toast.error("Upgrade to Premium Basic or higher to shortlist candidates");
      return;
    }
    setPendingShortlistInternship(internship);
    setAtsThreshold(30); // reset to default each time
    setAtsModalOpen(true);
  };

  const handleShortlist = async (id, description, skills, threshold) => {
    setAtsModalOpen(false);
    setLoadingShortlist(true);
    setModalData({
      open: true,
      internshipId: id,
      type: "shortlisted",
      loading: true,
    });
    try {
      let resumes = [];
      if (!applications[id]?.length) {
        const { data } = await axios.get(`/api/applications/internship/${id}`);
        const fetched = Array.isArray(data.applications)
          ? data.applications
          : [];
        setApplications((prev) => ({ ...prev, [id]: fetched }));
        resumes = fetched.map((s) => s.resumeUrl).filter(Boolean);
      } else {
        resumes = applications[id].map((s) => s.resumeUrl).filter(Boolean);
      }
      const formData = new FormData();
      formData.append("job_description", description || "");
      formData.append("job_skills", JSON.stringify(skills || []));
      resumes.forEach((url) => formData.append("resumes", url));
      formData.append("internship_id", id);
      formData.append("ats_threshold", String(threshold ?? 30));
      const { data } = await axios.post(
        `${AI_API}/partner/shortlist`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      setShortlistedCandidates((prev) => ({
        ...prev,
        [id]: data.shortlisted_candidates || [],
      }));
      toast.success(`Candidates shortlisted (ATS ≥ ${threshold ?? 30}%)!`);
    } catch {
      toast.error("Shortlisting failed. Please try again.");
    } finally {
      setLoadingShortlist(false);
      setModalData((prev) => ({ ...prev, loading: false }));
    }
  };

  const showShortlisted = async (internshipId) => {
    if (!hasPremiumAccess()) {
      toast.error(
        "Upgrade to Premium Basic or higher to view shortlisted candidates",
      );
      return;
    }
    setLoadingShortlist(true);
    setModalData({
      open: true,
      internshipId,
      type: "shortlisted",
      loading: true,
    });
    try {
      const { data } = await axios.get(
        `${AI_API}/partner/shortlisted/${internshipId}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      setShortlistedCandidates((prev) => ({
        ...prev,
        [internshipId]: data.shortlisted_candidates,
      }));
    } catch {
      toast.error("Failed to load shortlisted candidates.");
    } finally {
      setLoadingShortlist(false);
      setModalData((prev) => ({ ...prev, loading: false }));
    }
  };

  const updateApplicationStatus = async (studentId, status) => {
    try {
      await axios.put(`/api/applications/${studentId}/status`, { status });
      setApplications((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          updated[key] = updated[key].map((s) =>
            s._id === studentId ? { ...s, status } : s,
          );
        });
        return updated;
      });
    } catch {
      toast.error("Failed to update application status.");
    }
  };

  const handleSchedule = (internship) => {
    if (!hasFullPremiumAccess()) {
      toast.error("Upgrade to Premium Plus to schedule interviews");
      return;
    }
    setSelectedInternshipForSchedule({
      _id: internship._id,
      internshipMode: internship.internshipMode || "",
      pricingBucket: getPricingBucketFromInternship(internship),
    });
    setScheduleFormOpen(true);
  };

  const openScheduleViewer = (internshipId) => {
    if (!hasPremiumAccess()) {
      toast.error("Upgrade to Premium Basic or higher to view schedules");
      return;
    }
    setSelectedInternshipForView(internshipId);
    setScheduleViewerOpen(true);
  };

  const openAttendanceDashboard = (internshipId) => {
    setSelectedInternshipForAttendance(internshipId);
    setAttendanceDashboardOpen(true);
  };

  const openTimeSlotsSelected = (internshipId) => {
    if (!hasFullPremiumAccess()) {
      toast.error("Upgrade to Premium Plus to view accepted students");
      return;
    }
    setTimeSlotsModal({ open: true, internshipId });
  };

  const resetCloseScheduleModal = () => {
    setCloseScheduleModal(getDefaultCloseScheduleModalState());
  };

  const openCloseScheduleConfirmation = (internshipId) => {
    setCloseScheduleModal({
      ...getDefaultCloseScheduleModalState(),
      open: true,
      internshipId,
    });
  };

  const openCreateScheduleRequiredPopup = () => {
    setCloseScheduleModal({
      ...getDefaultCloseScheduleModalState(),
      open: true,
      internshipId: null,
      title: "Internship Schedule Required",
      message:
        "First create the internship schedule, then only you can close the internship schedule.",
      confirmLabel: "Yes",
      cancelLabel: "OK",
      hideConfirm: true,
    });
  };

  const openAlreadyClosedSchedulePopup = () => {
    setCloseScheduleModal({
      ...getDefaultCloseScheduleModalState(),
      open: true,
      internshipId: null,
      title: "Internship Schedule Closed",
      message: "The internship schedule is already closed.",
      confirmLabel: "Yes",
      cancelLabel: "OK",
      hideConfirm: true,
    });
  };

  const openCloseApplicationsRequiredPopup = () => {
    setCloseScheduleModal({
      ...getDefaultCloseScheduleModalState(),
      open: true,
      internshipId: null,
      title: "Applications Are Still Open",
      message:
        "Please close the applications (toggle set to Closed) before you can close the schedule.",
      confirmLabel: "Yes",
      cancelLabel: "OK",
      hideConfirm: true,
    });
  };

  const handleCloseScheduleModalCancel = () => {
    resetCloseScheduleModal();
  };

  const handleCloseScheduleTemplateStep = async () => {
    const internshipId = closeScheduleModal.internshipId;
    const partnerId = partnerData?._id || localStorage.getItem("partnerId");

    if (!internshipId || !partnerId) {
      toast.error(
        "Partner profile is not available. Please refresh and try again.",
      );
      return;
    }

    const cachedTemplates = getCachedCloseScheduleTemplates(partnerId);
    const initialTemplates = cachedTemplates.items;
    const hasCachedTemplates = cachedTemplates.loaded;

    setCloseScheduleModal({
      ...getDefaultCloseScheduleModalState(),
      open: true,
      internshipId,
      step: "templates",
      title: "Close Internship Schedule",
      message: hasCachedTemplates
        ? initialTemplates.length
          ? "Select one of your certificate design before closing this internship schedule."
          : "No saved certificate design were found."
        : "Loading your saved certificate designs...",
      confirmLabel: "Close Schedule",
      cancelLabel: "Back",
      templates: initialTemplates,
      selectedTemplateId: null,
      isLoadingTemplates: !hasCachedTemplates,
    });

    if (hasCachedTemplates) {
      return;
    }

    try {
      const templates = await fetchCloseScheduleTemplates(partnerId);

      setCloseScheduleModal((prev) => ({
        ...prev,
        message: templates.length
          ? "Select one of your certificate design before closing this internship schedule."
          : "No saved certificate design were found.",
        templates,
        selectedTemplateId: null,
        isLoadingTemplates: false,
      }));
    } catch (err) {
      console.error(
        "Error fetching certificate templates for close schedule:",
        err,
      );
      setCloseScheduleModal((prev) => ({
        ...prev,
        message:
          err.response?.data?.message ||
          "Failed to load saved certificate designs. You can still close the schedule without selecting one.",
        templates: [],
        selectedTemplateId: null,
        isLoadingTemplates: false,
      }));
    }
  };

  const handleCloseScheduleClick = async (internshipId) => {
    const partnerId = partnerData?._id || localStorage.getItem("partnerId");

    if (!partnerId) {
      toast.error(
        "Partner profile is not available. Please refresh and try again.",
      );
      return;
    }

    const internship = internships.find((i) => i._id === internshipId);
    if (internship && internship.applicationOpen) {
      openCloseApplicationsRequiredPopup();
      return;
    }

    try {
      const response = await axios.get("/api/schedule/get-schedule", {
        params: { internshipId, partnerId },
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (response.data?.isClosed) {
        openAlreadyClosedSchedulePopup();
        return;
      }

      const hasCreatedSchedule =
        (Array.isArray(response.data?.timetable) &&
          response.data.timetable.length > 0) ||
        (Array.isArray(response.data?.batches) &&
          response.data.batches.length > 0);

      if (!hasCreatedSchedule) {
        openCreateScheduleRequiredPopup();
        return;
      }

      fetchCloseScheduleTemplates(partnerId).catch(() => {});
      openCloseScheduleConfirmation(internshipId);
    } catch (err) {
      if (err.response?.status === 404) {
        openCreateScheduleRequiredPopup();
        return;
      }

      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to verify internship schedule",
      );
    }
  };

  const handleConfirmClose = async (
    internshipId,
    selectedTemplateId = null,
  ) => {
    const partnerId = partnerData?._id || localStorage.getItem("partnerId");

    if (!internshipId || !partnerId) {
      toast.error(
        "Partner profile is not available. Please refresh and try again.",
      );
      return;
    }

    try {
      setCloseScheduleModal((prev) => ({
        ...prev,
        isSubmitting: true,
      }));

      await axios.put(
        "/api/schedule/close",
        {
          internshipId,
          partnerId,
          certificateTemplateId: selectedTemplateId || undefined,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );

      toast.success("Schedule closed permanently!");
      resetCloseScheduleModal();
      setInternships((prev) =>
        prev.map((i) =>
          i._id === internshipId ? { ...i, isScheduleClosed: true } : i,
        ),
      );
    } catch (err) {
      if (err.response?.data?.error === "Schedule is already closed") {
        openAlreadyClosedSchedulePopup();
        return;
      }

      toast.error(err.response?.data?.error || "Failed to close schedule");
    } finally {
      setCloseScheduleModal((prev) => ({
        ...prev,
        isSubmitting: false,
      }));
    }
  };

  const handleCloseScheduleModalConfirm = async () => {
    if (closeScheduleModal.step === "templates") {
      await handleConfirmClose(
        closeScheduleModal.internshipId,
        closeScheduleModal.selectedTemplateId,
      );
      return;
    }

    await handleCloseScheduleTemplateStep();
  };

  const renderCloseScheduleTemplates = () => {
    if (closeScheduleModal.step !== "templates") return null;

    const filteredTemplates = closeScheduleModal.templates.filter((item) =>
      item.name
        ?.toLowerCase()
        .includes(closeScheduleModal.templateSearchQuery.trim().toLowerCase()),
    );
    const totalTemplatePages = Math.max(
      1,
      Math.ceil(filteredTemplates.length / CLOSE_SCHEDULE_TEMPLATES_PER_PAGE),
    );
    const activeTemplatePage = Math.min(
      closeScheduleModal.templatePage,
      totalTemplatePages,
    );
    const paginatedTemplates = filteredTemplates.slice(
      (activeTemplatePage - 1) * CLOSE_SCHEDULE_TEMPLATES_PER_PAGE,
      activeTemplatePage * CLOSE_SCHEDULE_TEMPLATES_PER_PAGE,
    );

    if (closeScheduleModal.isLoadingTemplates) {
      return (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left">
          <p className="text-sm font-semibold text-gray-700">
            Loading saved certificate designs...
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
              <div
                key={item}
                className="h-52 animate-pulse rounded-2xl border border-gray-200 bg-white"
                style={{
                  contain: "layout paint",
                  contentVisibility: "auto",
                  containIntrinsicSize: "240px 320px",
                }}
              />
            ))}
          </div>
        </div>
      );
    }

    if (!closeScheduleModal.templates.length) {
      return (
        <div className="mb-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-left">
          <p className="text-sm font-semibold text-gray-700">
            No certificate designs available
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Add designs in Custom Internship Certificate if you want them to
            appear here when closing the schedule.
          </p>
        </div>
      );
    }

    return (
      <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left">
        <div className="mb-4">
          <div>
            <div className="relative">
              <FontAwesomeIcon
                icon={faSearch}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400"
              />
              <input
                type="text"
                value={closeScheduleModal.templateSearchQuery}
                onChange={(e) =>
                  setCloseScheduleModal((prev) => ({
                    ...prev,
                    templateSearchQuery: e.target.value,
                    templatePage: 1,
                    selectedTemplateId: null,
                  }))
                }
                placeholder="Search saved certificate designs"
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        {filteredTemplates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
            <p className="text-sm font-semibold text-gray-700">
              No certificate designs found
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Try another template name in the search box.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedTemplates.map((item) => {
                const isSelected =
                  closeScheduleModal.selectedTemplateId === item._id;

                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() =>
                      setCloseScheduleModal((prev) => ({
                        ...prev,
                        selectedTemplateId: item._id,
                      }))
                    }
                    className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition ${
                      isSelected
                        ? "border-blue-500 ring-2 ring-blue-100"
                        : "border-gray-200 hover:border-blue-300 hover:shadow-md"
                    }`}
                    style={{
                      contain: "layout paint",
                      contentVisibility: "auto",
                      containIntrinsicSize: "240px 320px",
                    }}
                  >
                    <div className="h-44 overflow-hidden bg-gray-100">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="flex-1 truncate text-sm font-semibold text-gray-900">
                          {item.name}
                        </p>
                        {isSelected && (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {totalTemplatePages > 1 && (
              <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-gray-500">
                  Showing{" "}
                  {(activeTemplatePage - 1) *
                    CLOSE_SCHEDULE_TEMPLATES_PER_PAGE +
                    1}
                  -
                  {Math.min(
                    activeTemplatePage * CLOSE_SCHEDULE_TEMPLATES_PER_PAGE,
                    filteredTemplates.length,
                  )}{" "}
                  of {filteredTemplates.length} designs
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCloseScheduleModal((prev) => ({
                        ...prev,
                        templatePage: Math.max(activeTemplatePage - 1, 1),
                      }))
                    }
                    disabled={activeTemplatePage === 1}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>

                  {Array.from(
                    { length: totalTemplatePages },
                    (_, index) => index + 1,
                  ).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() =>
                        setCloseScheduleModal((prev) => ({
                          ...prev,
                          templatePage: pageNumber,
                        }))
                      }
                      className={`min-w-10 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        activeTemplatePage === pageNumber
                          ? "border-blue-500 bg-blue-600 text-white"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setCloseScheduleModal((prev) => ({
                        ...prev,
                        templatePage: Math.min(
                          activeTemplatePage + 1,
                          totalTemplatePages,
                        ),
                      }))
                    }
                    disabled={activeTemplatePage === totalTemplatePages}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const closeModal = () =>
    setModalData({
      open: false,
      internshipId: null,
      type: null,
      loading: false,
    });

  // ─── Premium lock ────────────────────────────────────────────────────────────
  const showPremiumLock = (featureName, requiredPlan = "Premium Basic") => (
    <div className="relative group">
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-400 text-sm font-semibold rounded-lg cursor-not-allowed border border-gray-300"
      >
        <FontAwesomeIcon icon={faLock} className="text-xs" /> {featureName}
      </button>
      <div className="absolute z-20 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg py-1.5 px-3 bottom-full mb-2 whitespace-nowrap shadow-lg">
        Upgrade to {requiredPlan} to access this feature
        <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );

  // ─── Loading / error ─────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-xl gap-4">
          <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-lg font-semibold text-gray-800">
            Loading internships...
          </p>
          <p className="text-sm text-gray-400">Please wait a moment.</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-red-500 font-medium">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
        >
          Retry
        </button>
      </div>
    );

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="font-poppins max-w-5xl mx-auto px-4 py-6">
      {/* ── Page Header ── */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Internships</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage your posted internships and candidates
          </p>
        </div>
        {partnerData && (
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
              partnerData.isPremium
                ? partnerData.planType === "Premium Plus"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {partnerData.isPremium && (
              <FontAwesomeIcon
                icon={faCrown}
                className={
                  partnerData.planType === "Premium Plus"
                    ? "text-purple-500"
                    : "text-blue-500"
                }
              />
            )}
            {partnerData.planType === "Freemium"
              ? "Free Plan"
              : partnerData.planType}
            {partnerData.premiumExpiration && partnerData.isPremium && (
              <span className="opacity-60 ml-1">
                · Expires{" "}
                {new Date(partnerData.premiumExpiration).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Search + count ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5 p-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="relative flex-1">
          <FontAwesomeIcon
            icon={faSearch}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"
          />
          {/*Add the "!mt-0" style to the input for alignment - 04-08-2026 */}
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search by title, company, location…"
            className="!mt-0 w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white placeholder-gray-400 transition"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!isSearching && searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                clearTimeout(debounceRef.current);
                if (partnerIdRef.current)
                  fetchInternships(partnerIdRef.current, 1, "");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
            >
              <FontAwesomeIcon icon={faTimes} className="text-xs" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 text-sm text-gray-500">
          <FontAwesomeIcon icon={faBriefcase} className="text-blue-400" />
          {totalCount > 0 ? (
            <span>
              <span className="font-semibold text-gray-800">{totalCount}</span>
              {" internship"}
              {totalCount !== 1 ? "s" : ""}
              {debouncedQuery && (
                <span className="text-gray-400">
                  {" "}
                  for "<em>{debouncedQuery}</em>"
                </span>
              )}
              {totalPages > 1 && (
                <span className="text-gray-400 text-xs ml-1.5">
                  · Page {page} of {totalPages}
                </span>
              )}
            </span>
          ) : debouncedQuery ? (
            <span className="text-gray-400">
              No results for "<em>{debouncedQuery}</em>"
            </span>
          ) : (
            <span className="text-gray-400">No internships posted yet</span>
          )}
        </div>
      </div>

      {/* ── Filters: Type / Mode / Level ── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Type</label>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              if (partnerIdRef.current)
                fetchInternships(
                  partnerIdRef.current,
                  1,
                  debouncedQuery,
                  false,
                  e.target.value,
                  filterMode,
                  filterLevel,
                );
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition cursor-pointer"
          >
            <option>All Types</option>
            <option>Free</option>
            <option>Stipend</option>
            <option>Paid</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Mode</label>
          <select
            value={filterMode}
            onChange={(e) => {
              setFilterMode(e.target.value);
              if (partnerIdRef.current)
                fetchInternships(
                  partnerIdRef.current,
                  1,
                  debouncedQuery,
                  false,
                  filterType,
                  e.target.value,
                  filterLevel,
                );
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition cursor-pointer"
          >
            <option>All Modes</option>
            <option>Online</option>
            <option>Offline</option>
            <option>Hybrid</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Level</label>
          <select
            value={filterLevel}
            onChange={(e) => {
              setFilterLevel(e.target.value);
              if (partnerIdRef.current)
                fetchInternships(
                  partnerIdRef.current,
                  1,
                  debouncedQuery,
                  false,
                  filterType,
                  filterMode,
                  e.target.value,
                );
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition cursor-pointer"
          >
            <option>All Levels</option>
            <option>Basic</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </div>
      </div>

      {/* ── Cards ── */}
      {internships.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <FontAwesomeIcon
              icon={faBriefcase}
              className="text-2xl text-gray-300"
            />
          </div>
          <p className="text-base font-medium text-gray-500">
            No internships posted yet
          </p>
          <p className="text-sm text-gray-400">
            Post an internship to see candidates here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {internships.map((internship) => {
            const compensationText =
              internship.internshipType === "STIPEND"
                ? `${internship.compensationDetails?.amount} ${internship.compensationDetails?.currency} / ${internship.compensationDetails?.frequency?.toLowerCase()}`
                : internship.internshipType === "FREE"
                  ? "Unpaid / Free"
                  : internship.internshipType === "PAID"
                    ? `Student Pays: ${internship.compensationDetails?.amount} ${internship.compensationDetails?.currency}`
                    : "N/A";

            const isPaidInternship =
              (internship?.internshipType || "").toUpperCase() === "PAID";

            const quals = Array.isArray(internship.qualifications)
              ? internship.qualifications
              : internship.qualifications
                  ?.match(/[A-Z]?[^.!?]*[.!?]*/g)
                  ?.map((s) => s.trim())
                  .filter(Boolean) || [];

            const showAllQuals = qualExpanded[internship._id];
            const visibleQuals = showAllQuals ? quals : quals.slice(0, 3);
            const isDescExpanded = descExpanded[internship._id];

            return (
              <div
                key={internship._id}
                className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
              >
                {/* ── Card Top Bar ── */}
                <div className="flex items-start justify-between px-5 pt-5 pb-4 gap-4 flex-wrap">
                  {/* Logo + Title */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                      {internship.imgUrl ? (
                        <img
                          src={internship.imgUrl}
                          alt={internship.companyName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FontAwesomeIcon
                            icon={faBriefcase}
                            className="text-gray-400 text-lg"
                          />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-gray-900 truncate">
                          {internship.jobTitle}
                        </h3>
                        <TypeBadge type={internship.internshipType} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {internship.companyName}
                        <span className="mx-1.5">·</span>
                        {calculateDaysAgo(internship.createdAt)}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 whitespace-nowrap">
                        ID: {internship._id}
                      </p>
                    </div>
                  </div>

                  {/* Toggle */}
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <button
                      onClick={() =>
                        toggleApplicationOpen(
                          internship._id,
                          !internship.applicationOpen,
                        )
                      }
                      className="relative flex-shrink-0"
                      title={
                        internship.applicationOpen
                          ? "Close applications"
                          : "Open applications"
                      }
                    >
                      <div
                        className={`w-12 h-6 rounded-full transition-colors duration-300 ${
                          internship.applicationOpen
                            ? "bg-gradient-to-r from-teal-400 to-cyan-500"
                            : "bg-gradient-to-r from-red-400 to-pink-500"
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${
                            internship.applicationOpen
                              ? "translate-x-6"
                              : "translate-x-0.5"
                          }`}
                        />
                      </div>
                    </button>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        internship.applicationOpen
                          ? "bg-teal-50 text-teal-700 border border-teal-200"
                          : "bg-red-50 text-red-600 border border-red-200"
                      }`}
                    >
                      {internship.applicationOpen ? "Open" : "Closed"}
                    </span>
                  </div>
                </div>

                {/* ── Divider ── */}
                <div className="border-t border-gray-100 mx-5" />

                {/* ── Card Meta ── */}
                <div className="px-5 py-3 space-y-1.5">
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <FontAwesomeIcon
                        icon={faMapMarkerAlt}
                        className="text-gray-400"
                      />
                      {internship.location || "—"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FontAwesomeIcon
                        icon={faClock}
                        className="text-gray-400"
                      />
                      {internship.startDate
                        ? new Date(internship.startDate).toLocaleDateString(
                            "en-GB",
                            { day: "2-digit", month: "short", year: "numeric" },
                          )
                        : "—"}
                      {" – "}
                      {internship.endDateOrDuration
                        ? (() => {
                            const d = new Date(internship.endDateOrDuration);
                            return isNaN(d)
                              ? internship.endDateOrDuration
                              : d.toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                });
                          })()
                        : "—"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FontAwesomeIcon
                        icon={faDollarSign}
                        className="text-gray-400"
                      />
                      {compensationText}
                    </span>
                  </div>
                </div>

                {/* ── Description ── */}
                <div className="px-5 pb-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1">
                    Description
                  </p>
                  <p
                    className={`text-xs text-gray-500 leading-relaxed ${!isDescExpanded ? "line-clamp-2" : ""}`}
                  >
                    {internship.jobDescription || "No description provided."}
                  </p>
                  {internship.jobDescription?.length > 140 && (
                    <button
                      onClick={() =>
                        setDescExpanded((prev) => ({
                          ...prev,
                          [internship._id]: !prev[internship._id],
                        }))
                      }
                      className="mt-1 text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1 transition"
                    >
                      {isDescExpanded ? (
                        <>
                          <FontAwesomeIcon
                            icon={faChevronUp}
                            className="text-[10px]"
                          />{" "}
                          Show less
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon
                            icon={faChevronDown}
                            className="text-[10px]"
                          />{" "}
                          Read more
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* ── Qualifications ── */}
                {quals.length > 0 && (
                  <div className="px-5 pb-4">
                    <p className="text-xs font-semibold text-gray-700 mb-1.5">
                      Qualifications
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {visibleQuals.map((q, i) => (
                        <span
                          key={i}
                          className="text-[11px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-0.5 rounded-full"
                        >
                          {q}
                        </span>
                      ))}
                      {quals.length > 3 && (
                        <button
                          onClick={() =>
                            setQualExpanded((prev) => ({
                              ...prev,
                              [internship._id]: !prev[internship._id],
                            }))
                          }
                          className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold self-center transition"
                        >
                          {showAllQuals
                            ? "Show less"
                            : `+${quals.length - 3} more`}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Action Buttons ── */}
                <div className="border-t border-gray-100 px-5 py-3 flex flex-wrap gap-2 bg-gray-50 rounded-b-2xl">
                  {hasPremiumAccess() ? (
                    <button
                      onClick={() => fetchApplications(internship._id)}
                      disabled={loadingApplications[internship._id]}
                      className={`flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-semibold rounded-lg shadow hover:from-blue-600 hover:to-indigo-700 transition active:scale-95 ${
                        loadingApplications[internship._id]
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      <FontAwesomeIcon icon={faEye} />
                      {loadingApplications[internship._id]
                        ? "Loading..."
                        : "View Applications"}
                    </button>
                  ) : (
                    showPremiumLock("View Applications", "Premium Basic")
                  )}

                  {hasPremiumAccess() || hasFullPremiumAccess() ? (
                    <button
                      onClick={() => openAtsModal(internship)}
                      disabled={loadingShortlist}
                      className={`flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold rounded-lg shadow hover:from-emerald-600 hover:to-teal-600 transition active:scale-95 ${
                        loadingShortlist ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      <FontAwesomeIcon icon={faStar} />
                      {loadingShortlist ? "Shortlisting..." : "Shortlist"}
                    </button>
                  ) : (
                    showPremiumLock("Shortlist", "Premium Basic")
                  )}

                  {hasPremiumAccess() || hasFullPremiumAccess() ? (
                    <button
                      onClick={() => showShortlisted(internship._id)}
                      disabled={loadingShortlist}
                      className={`flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white text-xs font-semibold rounded-lg shadow hover:from-purple-600 hover:to-violet-700 transition active:scale-95 ${
                        loadingShortlist ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      <FontAwesomeIcon icon={faDownload} />
                      {loadingShortlist ? "Loading..." : "Shortlisted Resumes"}
                    </button>
                  ) : (
                    showPremiumLock("Shortlisted Resumes", "Premium Basic")
                  )}

                  {isPaidInternship &&
                    (hasFullPremiumAccess() ? (
                      <button
                        onClick={() => openTimeSlotsSelected(internship._id)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-slate-600 to-gray-700 text-white text-xs font-semibold rounded-lg shadow hover:from-slate-700 hover:to-gray-800 transition active:scale-95"
                      >
                        <FontAwesomeIcon icon={faCalendarAlt} /> Time Slots
                      </button>
                    ) : (
                      showPremiumLock("Time Slots Selected", "Premium Plus")
                    ))}

                  {hasFullPremiumAccess() ? (
                    <>
                      <button
                        onClick={() => handleSchedule(internship)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-semibold rounded-lg shadow hover:from-amber-500 hover:to-orange-600 transition active:scale-95"
                      >
                        <FontAwesomeIcon icon={faClock} /> Schedule
                      </button>

                      {hasPremiumAccess() ? (
                        <>
                          <button
                            onClick={() => openScheduleViewer(internship._id)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-sky-500 text-white text-xs font-semibold rounded-lg shadow hover:from-cyan-600 hover:to-sky-600 transition active:scale-95"
                          >
                            <FontAwesomeIcon icon={faCalendarAlt} /> View
                            Schedule
                          </button>
                          <button
                            onClick={() =>
                              openAttendanceDashboard(internship._id)
                            }
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-xs font-semibold rounded-lg shadow hover:from-teal-600 hover:to-emerald-600 transition active:scale-95"
                          >
                            <FontAwesomeIcon icon={faUserCheck} /> Attendance
                          </button>
                        </>
                      ) : (
                        showPremiumLock("View Schedule", "Premium Basic")
                      )}

                      <button
                        onClick={() => handleCloseScheduleClick(internship._id)}
                        className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-rose-400 to-pink-400 text-white text-xs font-semibold rounded-lg shadow hover:from-rose-500 hover:to-pink-500 transition active:scale-95"
                      >
                        <FontAwesomeIcon icon={faTimes} /> Close Schedule
                      </button>
                    </>
                  ) : (
                    showPremiumLock("Schedule", "Premium Plus")
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
          <button
            onClick={() =>
              fetchInternships(partnerIdRef.current, page - 1, debouncedQuery)
            }
            disabled={page === 1 || loadingMore}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(
            (pageNum) => (
              <button
                key={pageNum}
                onClick={() =>
                  fetchInternships(
                    partnerIdRef.current,
                    pageNum,
                    debouncedQuery,
                  )
                }
                disabled={loadingMore}
                className={`w-9 h-9 rounded-lg text-sm font-semibold transition ${
                  pageNum === page
                    ? "bg-blue-600 text-white shadow"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {pageNum}
              </button>
            ),
          )}
          <button
            onClick={() =>
              fetchInternships(partnerIdRef.current, page + 1, debouncedQuery)
            }
            disabled={!hasMore || loadingMore}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loadingMore ? "Loading..." : "Next →"}
          </button>
        </div>
      )}

      {/* ── Applications / Shortlisted Modal ── */}
      <Modal
        isOpen={modalData.open}
        onClose={closeModal}
        title={
          modalData.type === "applications"
            ? "Applications"
            : "Shortlisted Candidates"
        }
        isLoading={modalData.loading}
        preventBackdropClose={true}
      >
        {modalData.type === "applications" &&
          !modalData.loading &&
          ((applications[modalData.internshipId] || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <FontAwesomeIcon
                icon={faEye}
                className="text-3xl text-gray-200"
              />
              <p className="text-sm font-medium">No applications yet</p>
            </div>
          ) : (
            <ApplicationsTable
              applications={applications[modalData.internshipId]}
              onStatusUpdate={updateApplicationStatus}
            />
          ))}
        {modalData.type === "shortlisted" &&
          !modalData.loading &&
          ((shortlistedCandidates[modalData.internshipId] || []).length ===
          0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <FontAwesomeIcon
                icon={faStar}
                className="text-3xl text-gray-200"
              />
              <p className="text-sm font-medium">
                No candidates shortlisted yet
              </p>
            </div>
          ) : (
            <ShortlistedTable
              candidates={shortlistedCandidates[modalData.internshipId]}
              internshipId={modalData.internshipId}
              internshipTitle={
                internships.find((i) => i._id === modalData.internshipId)
                  ?.jobTitle || "Internship"
              }
            />
          ))}
      </Modal>

      {/* ── Schedule Form Modal ── */}
      <Modal
        isOpen={scheduleFormOpen}
        onClose={() => {
          setScheduleFormOpen(false);
          setSelectedInternshipForSchedule(null);
        }}
        title="Create Internship Schedule"
      >
        {selectedInternshipForSchedule?._id && (
          <ScheduleForm
            internshipId={selectedInternshipForSchedule._id}
            initialInternshipMode={selectedInternshipForSchedule.internshipMode}
            initialPricingBucket={selectedInternshipForSchedule.pricingBucket}
            onClose={() => {
              setScheduleFormOpen(false);
              setSelectedInternshipForSchedule(null);
            }}
          />
        )}
      </Modal>

      {/* ── Time Slots Modal ── */}
      <Modal
        isOpen={timeSlotsModal.open}
        onClose={() => setTimeSlotsModal({ open: false, internshipId: null })}
        title="Time Slots Selected"
      >
        {timeSlotsModal.internshipId && (
          <TimeSlotsSelected internshipId={timeSlotsModal.internshipId} />
        )}
      </Modal>

      <ConfirmCloseSchedule
        isOpen={closeScheduleModal.open}
        onCancel={handleCloseScheduleModalCancel}
        onConfirm={handleCloseScheduleModalConfirm}
        title={closeScheduleModal.title}
        message={closeScheduleModal.message}
        confirmLabel={
          closeScheduleModal.isLoadingTemplates
            ? "Loading..."
            : closeScheduleModal.isSubmitting
              ? "Closing..."
              : closeScheduleModal.confirmLabel
        }
        cancelLabel={closeScheduleModal.cancelLabel}
        hideConfirm={closeScheduleModal.hideConfirm}
        hideCancel={closeScheduleModal.step === "templates"}
        hideTitle={closeScheduleModal.step === "templates"}
        confirmDisabled={
          closeScheduleModal.isLoadingTemplates ||
          closeScheduleModal.isSubmitting ||
          (closeScheduleModal.step === "templates" &&
            closeScheduleModal.templates.length > 0 &&
            !closeScheduleModal.selectedTemplateId)
        }
        disableCancel={closeScheduleModal.isSubmitting}
        dialogClassName={
          closeScheduleModal.step === "templates"
            ? "w-full max-w-5xl"
            : "w-[500px] max-w-[92vw]"
        }
      >
        {renderCloseScheduleTemplates()}
      </ConfirmCloseSchedule>

      <InternshipScheduleViewer
        isOpen={scheduleViewerOpen}
        onClose={() => {
          setScheduleViewerOpen(false);
          setSelectedInternshipForView(null);
        }}
        internshipId={selectedInternshipForView}
        partnerId={partnerData?._id || localStorage.getItem("partnerId")}
      />

      <AttendanceDashboard
        isOpen={attendanceDashboardOpen}
        onClose={() => {
          setAttendanceDashboardOpen(false);
          setSelectedInternshipForAttendance(null);
        }}
        internshipId={selectedInternshipForAttendance}
        partnerId={partnerData?._id || localStorage.getItem("partnerId")}
      />

      {/* ── ATS Threshold Modal ── */}
      {atsModalOpen && pendingShortlistInternship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-sm p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-medium text-gray-900">
                  Set ATS threshold
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Only resumes at or above this score will be shortlisted.
                </p>
              </div>
              <button
                onClick={() => {
                  setAtsModalOpen(false);
                  setPendingShortlistInternship(null);
                }}
                className="text-gray-300 hover:text-gray-500 transition text-xl leading-none mt-[-2px]"
              >
                ×
              </button>
            </div>

            {/* Internship pill */}
            <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3.5 py-2.5 border border-gray-100">
              <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-3.5 h-3.5 text-blue-500"
                  fill="none"
                  viewBox="0 0 16 16"
                >
                  <rect
                    x="2"
                    y="2"
                    width="12"
                    height="12"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M5 8h6M5 5.5h6M5 10.5h4"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="text-sm text-gray-600 font-medium truncate">
                {pendingShortlistInternship.jobTitle} —{" "}
                {pendingShortlistInternship.companyName}
              </span>
            </div>

            {/* Score + Slider */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Minimum ATS score</span>
                <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                  <span className="text-xl font-medium text-emerald-700 min-w-[36px] text-right leading-none">
                    {atsThreshold}
                  </span>
                  <span className="text-sm font-medium text-emerald-600">
                    %
                  </span>
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={atsThreshold}
                onChange={(e) => setAtsThreshold(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />

              <div className="flex justify-between text-[11px] text-gray-400 px-0.5">
                <span>0% — all</span>
                <span>50%</span>
                <span>100% — strict</span>
              </div>
            </div>

            {/* Hint badge */}
            <div
              className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border text-xs font-medium ${
                atsThreshold >= 70
                  ? "bg-green-50 border-green-100 text-green-700"
                  : atsThreshold >= 40
                    ? "bg-amber-50 border-amber-100 text-amber-700"
                    : "bg-blue-50 border-blue-100 text-blue-600"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  atsThreshold >= 70
                    ? "bg-green-500"
                    : atsThreshold >= 40
                      ? "bg-amber-500"
                      : "bg-blue-400"
                }`}
              />
              {atsThreshold >= 70
                ? "Strict — only highly relevant resumes will pass"
                : atsThreshold >= 40
                  ? "Balanced — good mix of quality and quantity"
                  : "Relaxed — more candidates will be included"}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => {
                  setAtsModalOpen(false);
                  setPendingShortlistInternship(null);
                }}
                className="py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleShortlist(
                    pendingShortlistInternship._id,
                    pendingShortlistInternship.jobDescription,
                    pendingShortlistInternship.qualifications || [],
                    atsThreshold,
                  )
                }
                className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition active:scale-95 flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon icon={faStar} className="text-xs" />
                Shortlist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternshipList;
//changes
