'use client';

import { getSupportedLanguages } from '@/lib/voice/language-config';

interface LanguageSelectorProps {
  value:    string;
  onChange: (lang: string) => void;
  label?:   string;
}

export function LanguageSelector({ value, onChange, label }: LanguageSelectorProps) {
  const languages = getSupportedLanguages();

  return (
    <div>
      {label && (
        <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flagEmoji} {lang.name} — {lang.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}