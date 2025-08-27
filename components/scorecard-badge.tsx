'use client';

interface ScorecardBadgeProps {
  score: number;
  letterGrade: string;
  size?: 'sm' | 'md' | 'lg';
}

const getGradeColor = (grade: string) => {
  switch (grade) {
    case 'A': return 'bg-green-100 text-green-800 border-green-200';
    case 'B': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'D': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'F': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getSizeClasses = (size: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm': return 'w-16 h-16 text-lg';
    case 'md': return 'w-24 h-24 text-2xl';
    case 'lg': return 'w-32 h-32 text-4xl';
    default: return 'w-24 h-24 text-2xl';
  }
};

export default function ScorecardBadge({ score, letterGrade, size = 'md' }: ScorecardBadgeProps) {
  return (
    <div className={`${getSizeClasses(size)} ${getGradeColor(letterGrade)} rounded-full border-2 flex items-center justify-center font-bold shadow-lg`}>
      <div className="leading-none">{letterGrade}</div>
    </div>
  );
}