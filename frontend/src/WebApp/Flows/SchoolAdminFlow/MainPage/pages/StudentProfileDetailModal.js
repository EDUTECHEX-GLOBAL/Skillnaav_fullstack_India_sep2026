import React, { useEffect, useState } from 'react';
import axios from '../../../../../api/axiosInstance';
import {
  Loader2, CheckCircle2, XCircle, User, Mail, GraduationCap,
  Briefcase, MapPin, Star, Link, X,
} from 'lucide-react';

// ─── Field-category groupings ─────────────────────────────────────────────────
const CATEGORIES = [
  {
    title: 'Basic Info',
    icon: <User size={16} />,
    fields: ['name', 'email', 'dob', 'profileImage'],
    labels: {
      name: 'Full Name',
      email: 'Email',
      dob: 'Date of Birth',
      profileImage: 'Profile Photo',
    },
  },
  {
    title: 'Education',
    icon: <GraduationCap size={16} />,
    fields: ['universityName', 'educationLevel', 'fieldOfStudy', 'currentGrade', 'gradePercentage'],
    labels: {
      universityName: 'University / School',
      educationLevel: 'Education Level',
      fieldOfStudy:   'Field of Study',
      currentGrade:   'Current Grade',
      gradePercentage:'Grade %',
    },
  },
  {
    title: 'Career',
    icon: <Briefcase size={16} />,
    fields: ['desiredField', 'skills', 'interests'],
    labels: {
      desiredField: 'Desired Career Field',
      skills:       'Skills',
      interests:    'Interests',
    },
  },
  {
    title: 'Location',
    icon: <MapPin size={16} />,
    fields: ['country', 'city', 'state', 'postalCode', 'preferredLocations'],
    labels: {
      country:            'Country',
      city:               'City',
      state:              'State',
      postalCode:         'Postal Code',
      preferredLocations: 'Preferred Job Locations',
    },
  },
  {
    title: 'Online Presence',
    icon: <Link size={16} />,
    fields: ['linkedin', 'portfolio'],
    labels: { linkedin: 'LinkedIn', portfolio: 'Portfolio' },
  },
  {
    title: 'Other',
    icon: <Star size={16} />,
    fields: ['financialStatus'],
    labels: { financialStatus: 'Financial Status' },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fieldIsFilled(val) {
  if (Array.isArray(val)) return val.length > 0;
  return val !== undefined && val !== null && val !== '';
}

// For profileImage: treat a base64 data URL or a proper URL as "filled"
function imageIsFilled(val) {
  if (!val || typeof val !== 'string' || val.trim() === '') return false;
  return val.startsWith('data:image') || val.startsWith('http') || val.startsWith('/') || val.startsWith('uploads');
}

const getProfileImageUrl = (profileImage) => {
  if (!profileImage || typeof profileImage !== "string" || profileImage.trim() === "") return null;
  if (profileImage.startsWith("data:image") || profileImage.startsWith("http://") || profileImage.startsWith("https://")) {
    return profileImage;
  }
  const baseUrl = process.env.REACT_APP_API_BASE || "http://localhost:5000";
  const normalizedImage = profileImage.replace(/\\/g, "/");
  if (normalizedImage.startsWith("/")) return `${baseUrl}${normalizedImage}`;
  if (normalizedImage.startsWith("uploads/")) return `${baseUrl}/${normalizedImage}`;
  return `${baseUrl}/uploads/${normalizedImage}`;
};

function displayValue(key, val) {
  // profileImage is handled separately — never render raw string here
  if (key === 'profileImage') return null;
  if (Array.isArray(val)) return val.join(', ');
  if (val === true)  return 'Yes';
  if (val === false) return 'No';
  return String(val);
}

// ─── Profile image renderer ───────────────────────────────────────────────────
function ProfileImageField({ src }) {
  const [broken, setBroken] = useState(false);
  const hasSrc = imageIsFilled(src) && !broken;

  return (
    <div className="flex items-center gap-3 mt-1">
      {hasSrc ? (
        <img
          src={getProfileImageUrl(src)}
          alt="Profile"
          onError={() => setBroken(true)}
          className="w-14 h-14 rounded-full object-cover border border-gray-200 shadow-sm"
        />
      ) : (
        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200">
          <User size={24} className="text-blue-400" />
        </div>
      )}
      <span className="text-xs text-gray-400 italic">
        {hasSrc ? 'Photo uploaded' : 'No photo uploaded'}
      </span>
    </div>
  );
}

// ─── Big completion ring ──────────────────────────────────────────────────────
function BigRing({ pct }) {
  const r      = 44;
  const circ   = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color  = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';

  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
      <circle
        cx="55" cy="55" r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 55 55)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="55" y="50" textAnchor="middle" dominantBaseline="central"
        fontSize="20" fontWeight="800" fill={color}>
        {pct}%
      </text>
      <text x="55" y="68" textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="500">
        COMPLETE
      </text>
    </svg>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
const StudentProfileDetailModal = ({ studentId, onClose }) => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('schoolAdminToken');
      try {
        const res = await axios.get(
          `/api/school-admin/students/${studentId}/profile-detail`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [studentId]);

  const student    = data?.student    || {};
  const completion = data?.completion || { percentage: 0, completedFields: [], missingFields: [] };

  // Avatar in the top bar
  const topAvatarSrc = imageIsFilled(student.profileImage) ? student.profileImage : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 font-poppins p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Top bar ── */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {topAvatarSrc ? (
              <img
                src={getProfileImageUrl(topAvatarSrc)}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center">
                <User size={18} />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{student.name || 'Student Profile'}</h2>
              <p className="text-sm text-gray-500">{student.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {loading ? (
            <div className="flex justify-center items-center py-16 gap-2 text-blue-500">
              <Loader2 className="animate-spin" size={22} />
              <span>Loading profile…</span>
            </div>
          ) : error ? (
            <p className="text-red-500 text-center py-10">{error}</p>
          ) : (
            <>
              {/* ── Completion summary ── */}
              <div className="flex items-center gap-8 mb-6 p-5 bg-gray-50 rounded-xl border border-gray-100">
                <BigRing pct={completion.percentage} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    {completion.missingFields.length} field(s) still missing
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {completion.missingFields.map((f) => (
                      <span key={f.label} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                        {f.label} ({f.weight}pts)
                      </span>
                    ))}
                    {completion.missingFields.length === 0 && (
                      <span className="text-green-600 font-semibold text-sm">✓ All fields completed!</span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Field-by-field breakdown ── */}
              <div className="space-y-5">
                {CATEGORIES.map((cat) => {
                  const catFields = cat.fields.map((key) => {
                    const val = student[key];
                    // profileImage uses its own filled check
                    const filled = key === 'profileImage'
                      ? imageIsFilled(val)
                      : fieldIsFilled(val);
                    return { key, label: cat.labels[key], value: val, filled };
                  });

                  const filledCount = catFields.filter(f => f.filled).length;

                  return (
                    <div key={cat.title} className="border border-gray-100 rounded-xl overflow-hidden">
                      {/* category header */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-pink-50 border-b border-pink-100">
                        <div className="flex items-center gap-2 text-gray-700 font-medium text-sm">
                          {cat.icon} {cat.title}
                        </div>
                        <span className="text-xs text-gray-500">{filledCount}/{catFields.length} fields</span>
                      </div>

                      {/* fields */}
                      <div className="divide-y divide-gray-50">
                        {catFields.map((f) => (
                          <div
                            key={f.key}
                            className={`flex items-start gap-3 px-4 py-3 ${f.filled ? '' : 'bg-red-50/30'}`}
                          >
                            <div className="mt-0.5 flex-shrink-0">
                              {f.filled
                                ? <CheckCircle2 size={15} className="text-green-500" />
                                : <XCircle     size={15} className="text-red-400"   />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-500 mb-0.5">{f.label}</p>

                              {/* ── profileImage: render actual image / default icon ── */}
                              {f.key === 'profileImage' ? (
                                <ProfileImageField src={f.value} />
                              ) : f.filled ? (
                                <p className="text-sm text-gray-800 break-words">
                                  {displayValue(f.key, f.value)}
                                </p>
                              ) : (
                                <p className="text-sm text-red-400 italic">Not provided</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentProfileDetailModal;