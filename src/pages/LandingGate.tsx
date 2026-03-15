import React from 'react';

const SAFETY_RED = '#FF4136';

interface LandingGateProps {
  onVolunteer: () => void;
  onNeedHelp: () => void;
}

export default function LandingGate({ onVolunteer, onNeedHelp }: LandingGateProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2 text-center">
        ReliefLink.JA
      </h1>
      <p className="text-gray-600 mb-8 sm:mb-12 text-center">
        Disaster response logistics for Jamaica
      </p>

      <div className="w-full max-w-2xl flex flex-col sm:flex-row gap-4 sm:gap-6 items-center justify-center">
        {/* Volunteer/Logistics Login - Blue, standard font */}
        <button
          type="button"
          onClick={onVolunteer}
          className="w-[40vw] sm:w-[40%] max-w-full py-6 sm:py-8 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-lg sm:text-xl transition-colors shadow-lg"
        >
          Volunteer/Logistics Login
        </button>

        {/* I NEED HELP NOW - Safety Red, bold, pulsing, 60% screen width on mobile */}
        <button
          type="button"
          onClick={onNeedHelp}
          className="w-[60vw] sm:w-[60%] max-w-full py-6 sm:py-8 px-6 rounded-xl font-bold text-lg sm:text-xl text-white transition-all distress-pulse"
          style={{
            backgroundColor: SAFETY_RED,
            boxShadow: `0 0 24px ${SAFETY_RED}66`,
          }}
        >
          I NEED HELP NOW
        </button>
      </div>

      <p className="mt-8 text-gray-500 text-sm text-center max-w-md">
        Volunteers: sign in to access the logistics dashboard and map.
        <br />
        In distress: tap the red button for immediate assistance—no login required.
      </p>
    </div>
  );
}
