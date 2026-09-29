import React, { useEffect, useState } from 'react';
import { FiCheck, FiClipboard, FiLink, FiMail, FiX } from 'react-icons/fi';
import axios from '../../../../api/axiosInstance';

const CreateMeetingLink = ({ internshipId, meetingLink, onMeetingLinkCreated, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [createdLink, setCreatedLink] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [googleAuthUrl, setGoogleAuthUrl] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);

  useEffect(() => {
    const handleGoogleConnected = (event) => {
      if (event.data?.type !== 'skillnaav-google-calendar-connected') return;
      setGoogleAuthUrl('');
      setError('');
      setGoogleConnected(true);
    };

    window.addEventListener('message', handleGoogleConnected);
    return () => window.removeEventListener('message', handleGoogleConnected);
  }, []);

  const handleSubmit = async () => {
    if (!recipientEmail.trim() || isCreating) return;

    setError('');
    setGoogleAuthUrl('');
    setGoogleConnected(false);
    setIsCreating(true);

    try {
      const { data } = await axios.post(
        '/api/google/create-meeting',
        { recipientEmail, internshipId },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      setCreatedLink(data.meetingLink);
      onMeetingLinkCreated(data.meetingLink);
    } catch (requestError) {
      const response = requestError.response?.data;
      setGoogleAuthUrl(response?.authUrl || '');
      setError(response?.message || 'Could not create the meeting link. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const copyLink = async () => {
    const link = createdLink || meetingLink;
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy automatically. Select the link and copy it manually.');
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="inline-flex items-center px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        <FiLink className="mr-2" />
        Create Meeting Link
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Create a Google Meet link</p>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close meeting link form"
          className="text-gray-500 hover:text-gray-700"
        >
          <FiX />
        </button>
      </div>

      {!createdLink ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="meeting-partner-email">
              Partner email
            </label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="meeting-partner-email"
                type="email"
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    handleSubmit();
                  }
                }}
                required
                autoFocus
                disabled={isCreating}
                placeholder="partner@example.com"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isCreating || !recipientEmail.trim()}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait transition"
          >
            {isCreating ? 'Creating meeting…' : 'Create and send invitation'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="flex items-center text-sm text-green-700">
            <FiCheck className="mr-2" /> Invitation sent to {recipientEmail}
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={createdLink}
              readOnly
              aria-label="Created Google Meet link"
              className="block min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700"
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center px-3 py-2 text-sm font-semibold text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50"
            >
              {copied ? <FiCheck className="mr-2" /> : <FiClipboard className="mr-2" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {googleConnected && (
        <p className="flex items-center text-sm text-green-700">
          <FiCheck className="mr-2" />
          Google Calendar connected. Click “Create and send invitation” again.
        </p>
      )}
      {googleAuthUrl && (
        <button
          type="button"
          onClick={() => window.open(googleAuthUrl, 'skillnaav-google-calendar', 'width=520,height=700')}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          Connect Google Calendar
        </button>
      )}
    </div>
  );
};

export default CreateMeetingLink;
