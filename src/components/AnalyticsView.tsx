import React from 'react';
import { StudyAnalytics } from '../types';
import { BarChart3, Clock, Target, Trophy, Flame, TrendingUp, BookOpen, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

interface AnalyticsViewProps {
  analytics: StudyAnalytics | null;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ analytics }) => {
  if (!analytics) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-[#FAF8F3] rounded-[32px] border border-[#f0ece1]">
        <div className="w-16 h-16 rounded-[24px] bg-white shadow-sm border border-gray-100 flex items-center justify-center mb-4">
          <BarChart3 className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">No Analytics Available</h3>
        <p className="text-sm text-gray-500 max-w-sm text-center">
          Take a quiz or review some flashcards to start generating insights.
        </p>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Quizzes', value: analytics.totalQuizzesTaken, icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { label: 'Average Score', value: `${analytics.averageScore}%`, icon: Trophy, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100' },
    { label: 'Questions Answered', value: analytics.totalQuestionsSolved, icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Study Streak', value: `${analytics.studyStreakDays} Days`, icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-500" /> Performance Analytics
          </h2>
          <p className="text-xs text-gray-500 mt-1">Track your progress and mastery over time</p>
        </div>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-5 rounded-[24px] border border-[#f0ece1] shadow-sm flex flex-col justify-between h-[130px]"
          >
            <div className="flex items-center gap-2 text-gray-500">
              <div className={`w-8 h-8 rounded-full ${stat.bg} ${stat.border} border flex items-center justify-center shrink-0`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <span className="text-xs font-semibold">{stat.label}</span>
            </div>
            <div className="flex items-end gap-3 mt-4">
              <span className="text-[32px] font-black text-gray-900 leading-none">{stat.value}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        
        {/* Recent Performance */}
        <div className="bg-white rounded-[32px] border border-[#f0ece1] shadow-sm p-6 flex flex-col min-h-[300px]">
          <h3 className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" /> Recent Quiz Scores
          </h3>
          
          <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-2">
            {(analytics.accuracyTrend?.length || analytics.recentAttempts?.length) > 0 ? (
              (analytics.accuracyTrend?.length
                ? analytics.accuracyTrend.map((t) => t.score)
                : analytics.recentAttempts.slice(0, 8).map((a) => a.score)
              ).map((score, i) => (
                <div key={i} className="flex flex-col items-center gap-2 w-full group">
                  <div className="w-full bg-gray-100 rounded-full h-[180px] relative overflow-hidden flex items-end">
                    <motion.div 
                      className={`w-full rounded-full transition-all group-hover:brightness-110 ${score >= 70 ? 'bg-teal-400' : 'bg-rose-400'}`}
                      initial={{ height: 0 }}
                      animate={{ height: `${score}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500">{score}%</span>
                </div>
              ))
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                No recent quizzes.
              </div>
            )}
          </div>
        </div>

        {/* Weak Areas (Topic Mastery) */}
        <div className="bg-white rounded-[32px] border border-[#f0ece1] shadow-sm p-6 flex flex-col min-h-[300px]">
          <h3 className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-400" /> Mastery by Topic
          </h3>
          
          <div className="flex-1 flex flex-col gap-5 overflow-y-auto pr-2">
            {(analytics.topTopics || []).length > 0 ? (
              [...analytics.topTopics]
                .sort((a, b) => b.score - a.score)
                .map(({ topic, score: mastery }, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700 truncate pr-4">{topic}</span>
                      <span className={mastery >= 70 ? 'text-teal-600' : 'text-rose-600'}>{mastery}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <motion.div
                        className={`h-full rounded-full ${mastery >= 70 ? 'bg-teal-400' : 'bg-rose-400'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${mastery}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                      />
                    </div>
                  </div>
                ))
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                Not enough data yet.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
