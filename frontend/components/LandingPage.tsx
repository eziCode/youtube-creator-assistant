import React from 'react';
import { RobotIcon, ChartBarIcon, MessageCircleIcon, FilmIcon } from './icons';

interface LandingPageProps {
  onLogin: () => void;
  // REMOVE-LATER: Prop for temporary dev button.
  onGoToDashboard: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ 
  onLogin, 
  // REMOVE-LATER: Prop for temporary dev button.
  onGoToDashboard 
}) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="absolute top-0 left-0 w-full z-10 p-4 md:p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-100 rounded-full text-indigo-600 animate-bounce-slow"><RobotIcon /></span>
            <span className="font-bold text-lg">YouTube AI Assistant</span>
          </div>
          <nav>
            <button
              onClick={onLogin}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white font-semibold text-sm shadow-sm hover:bg-indigo-700 transition-all"
            >
              Login
            </button>
          </nav>
        </div>
      </header>

        <main className="relative pt-32 pb-20 md:pt-48 md:pb-28">
        <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem]">
    <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_500px_at_50%_200px,#C9D6FF,#E2E8F0)]"></div></div>
        <div className="max-w-4xl mx-auto text-center px-4">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-500 to-indigo-500 animate-gradient-fade">
  Supercharge Your YouTube Channel with AI
</h1>
          <p className="mt-6 text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
            Get AI-powered analytics, manage comments effortlessly, and generate viral shorts from your long-form content. All in one place.
          </p>
          <div className="mt-8 flex justify-center items-center gap-4">
            <button onClick={onLogin} className="px-8 py-3 rounded-md bg-indigo-600 text-white font-semibold text-lg shadow-lg hover:bg-indigo-700 transition-transform hover:scale-105">
              Sign in with Google
            </button>
            {/* START: Temporary dev button. Delete this button later. */}
            <button onClick={onGoToDashboard} className="px-8 py-3 rounded-md border border-slate-300 bg-white text-slate-700 font-semibold text-lg shadow-sm hover:bg-slate-100 transition-transform hover:scale-105">
                Go to Dashboard
            </button>
            {/* END: Temporary dev button. */}
          </div>
        </div>
      </main>

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-800">Everything you need to grow</h2>
            <p className="mt-4 text-slate-500">Focus on creating, let AI handle the rest.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 border border-slate-200 rounded-xl hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-indigo-50 text-indigo-600 mx-auto">
                 <ChartBarIcon />
              </div>
              <h3 className="mt-5 text-lg font-semibold">AI Insights</h3>
              <p className="mt-2 text-sm text-slate-600">Understand your video performance with actionable suggestions from Gemini.</p>
            </div>
            <div className="text-center p-6 border border-slate-200 rounded-xl hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-indigo-50 text-indigo-600 mx-auto">
                <MessageCircleIcon />
              </div>
              <h3 className="mt-5 text-lg font-semibold">Smart Comment Replies</h3>
              <p className="mt-2 text-sm text-slate-600">Auto-reply to comments, filter by sentiment, and maintain your brand's tone.</p>
            </div>
            <div className="text-center p-6 border border-slate-200 rounded-xl hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-indigo-50 text-indigo-600 mx-auto">
                <FilmIcon />
              </div>
              <h3 className="mt-5 text-lg font-semibold">Shorts Generator</h3>
              <p className="mt-2 text-sm text-slate-600">Automatically find the most engaging clips from your videos to create YouTube Shorts.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} YouTube AI Assistant. Hackathon Project.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;