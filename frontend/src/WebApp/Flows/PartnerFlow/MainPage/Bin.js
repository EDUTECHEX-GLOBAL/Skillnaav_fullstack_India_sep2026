import React, { useEffect, useState } from "react";
import axios from "../../../../api/axiosInstance";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faRotateLeft,
  faLayerGroup,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

const Bin = () => {
  const [deletedPosts, setDeletedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postToDelete, setPostToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const partnerId = localStorage.getItem("partnerId");

  useEffect(() => {
    const fetchDeletedPosts = async () => {
      if (!partnerId) {
        setDeletedPosts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await axios.get(`/api/partner-bin/${partnerId}`);
        const posts = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];
        setDeletedPosts(posts);
      } catch (error) {
        if (error.response?.status === 404) {
          setDeletedPosts([]);
        } else {
          console.error("Error fetching deleted posts:", error);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchDeletedPosts();
  }, [partnerId]);

  const handleRestore = async (id) => {
    try {
      await axios.patch(`/api/partner-bin/${partnerId}/${id}/restore`);
      setDeletedPosts((prev) => prev.filter((p) => p._id !== id));
    } catch (error) {
      console.error("Error restoring post:", error);
      alert("Failed to restore post.");
    }
  };

  useEffect(() => {
    if (!postToDelete) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !deleting) setPostToDelete(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [postToDelete, deleting]);

  const handlePermanentDelete = async () => {
    if (!postToDelete || deleting) return;

    const id = postToDelete._id;
    setDeleting(true);
    try {
      await axios.delete(`/api/partner-bin/${partnerId}/${id}/permanent`);
      setDeletedPosts((prev) => prev.filter((p) => p._id !== id));
      setPostToDelete(null);
    } catch (error) {
      console.error("Error permanently deleting post:", error);
      alert("Failed to permanently delete post.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col h-full min-h-[500px]"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 border-b border-slate-100 mb-5 sm:mb-6">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20 shrink-0">
            <FontAwesomeIcon icon={faTrash} className="text-base sm:text-lg" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Bin – Deleted Internships
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Manage or restore your deleted internship postings
            </p>
          </div>
        </div>

        {!loading && deletedPosts.length > 0 && (
          <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
            <FontAwesomeIcon icon={faLayerGroup} className="text-slate-400 text-[11px]" />
            {deletedPosts.length} result{deletedPosts.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col justify-center items-center h-56 gap-3">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600" />
          <p className="text-xs font-semibold text-slate-400">Loading deleted internships…</p>
        </div>
      ) : deletedPosts.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
            <FontAwesomeIcon
              icon={faTrash}
              className="text-2xl opacity-60"
            />
          </div>
          <h3 className="text-base font-bold text-slate-800">Your bin is empty</h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm">
            Internships you delete will appear here before being permanently removed.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card View (< md) */}
          <div className="block md:hidden space-y-3.5">
            {deletedPosts.map((post, index) => (
              <div
                key={post._id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      #{index + 1}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug break-words mt-0.5">
                      {post.jobTitle}
                    </h3>
                    <p className="text-xs font-medium text-slate-600 mt-0.5">
                      {post.companyName}
                    </p>
                  </div>
                  {post.location && (
                    <span className="shrink-0 text-[11px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                      {post.location}
                    </span>
                  )}
                </div>

                {/* Actions row */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleRestore(post._id)}
                    className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-[0.98]"
                  >
                    <FontAwesomeIcon icon={faRotateLeft} className="text-[11px]" />
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostToDelete(post)}
                    className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/70 rounded-xl text-xs font-bold transition active:scale-[0.98]"
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-left">
                    <th className="px-5 py-3.5 text-slate-500 font-bold text-xs uppercase tracking-wider w-16">
                      #
                    </th>
                    <th className="px-5 py-3.5 text-slate-500 font-bold text-xs uppercase tracking-wider">
                      Job Title
                    </th>
                    <th className="px-5 py-3.5 text-slate-500 font-bold text-xs uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-5 py-3.5 text-slate-500 font-bold text-xs uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-5 py-3.5 text-slate-500 font-bold text-xs uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deletedPosts.map((post, index) => (
                    <tr
                      key={post._id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-5 py-4 text-slate-400 font-bold text-xs">
                        {index + 1}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-800">
                        {post.jobTitle}
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-medium">
                        {post.companyName}
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {post.location || "N/A"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => handleRestore(post._id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm hover:shadow active:scale-95"
                          >
                            <FontAwesomeIcon icon={faRotateLeft} className="text-[10px]" />
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => setPostToDelete(post)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 rounded-xl text-xs font-bold transition hover:shadow-sm active:scale-95"
                          >
                            <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {postToDelete && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setPostToDelete(null);
            }
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-post-title"
            aria-describedby="delete-post-description"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-xl" />
              </div>
              <div>
                <h3 id="delete-post-title" className="text-lg font-bold text-gray-900">
                  Permanently delete internship?
                </h3>
                <p id="delete-post-description" className="mt-2 text-sm leading-6 text-gray-500">
                  <span className="font-semibold text-gray-700">
                    {postToDelete.jobTitle}
                  </span>{" "}
                  will be permanently removed. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPostToDelete(null)}
                disabled={deleting}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FontAwesomeIcon icon={faTrash} />
                {deleting ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bin;
