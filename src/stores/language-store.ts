// ============================================================================
// EgBE Memory & Revision Engine — Language Preference Store (Zustand)
//
// Manages English/Thai bilingual toggle with localStorage persistence.
// All UI strings reference the active language and render accordingly.
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'en' | 'th';

export interface LanguageStore {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;

  // Localized text helpers (basic dictionary for store-level strings)
  t: (key: string) => string;
}

const DICTIONARY: Record<string, Record<Language, string>> = {
  'study.start': { en: 'Start Study', th: 'เริ่มเรียน' },
  'study.resume': { en: 'Resume', th: 'เรียนต่อ' },
  'study.complete': { en: 'Complete', th: 'เสร็จสิ้น' },
  'study.dueCards': { en: 'Cards Due', th: 'การ์ดที่ต้องทบทวน' },
  'study.newCards': { en: 'New Cards', th: 'การ์ดใหม่' },
  'scenario.start': { en: 'Start Scenario', th: 'เริ่มสถานการณ์จำลอง' },
  'scenario.submit': { en: 'Submit', th: 'ส่งคำตอบ' },
  'scenario.retry': { en: 'Try Again', th: 'ลองอีกครั้ง' },
  'scenario.exit': { en: 'Exit', th: 'ออก' },
  'graph.view': { en: 'View Graph', th: 'ดูกราฟ' },
  'graph.prerequisites': { en: 'Prerequisites', th: 'สิ่งที่ต้องรู้ก่อน' },
  'graph.applications': { en: 'Applications', th: 'การประยุกต์ใช้' },
  'sync.pushing': { en: 'Syncing...', th: 'กำลังซิงค์...' },
  'sync.complete': { en: 'Sync Complete', th: 'ซิงค์เสร็จสิ้น' },
  'sync.offline': { en: 'Offline', th: 'ออฟไลน์' },
  'sync.error': { en: 'Sync Error', th: 'ข้อผิดพลาดในการซิงค์' },
  'nav.curriculum': { en: 'Curriculum', th: 'หลักสูตร' },
  'nav.study': { en: 'Study', th: 'เรียน' },
  'nav.scenarios': { en: 'Scenarios', th: 'สถานการณ์จำลอง' },
  'nav.graph': { en: 'Knowledge Graph', th: 'กราฟความรู้' },
  'nav.settings': { en: 'Settings', th: 'ตั้งค่า' },
  'rating.again': { en: 'Again', th: 'อีกครั้ง' },
  'rating.hard': { en: 'Hard', th: 'ยาก' },
  'rating.good': { en: 'Good', th: 'ดี' },
  'rating.easy': { en: 'Easy', th: 'ง่าย' },
  'module.equations': { en: 'Equations', th: 'สมการ' },
  'module.flashcards': { en: 'Flashcards', th: 'แฟลชการ์ด' },
  'module.occlusion': { en: 'Image Occlusion', th: 'ภาพปิดบัง' },
  'module.scenarios': { en: 'Scenarios', th: 'สถานการณ์จำลอง' },
  'module.concepts': { en: 'Concepts', th: 'แนวคิด' },
};

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set, get) => ({
      language: 'en',

      setLanguage: (lang: Language) => set({ language: lang }),

      toggleLanguage: () =>
        set((state) => ({
          language: state.language === 'en' ? 'th' : 'en',
        })),

      t: (key: string): string => {
        const entry = DICTIONARY[key];
        if (!entry) return key;
        return entry[get().language] ?? key;
      },
    }),
    {
      name: 'egbe-language-preference',
    },
  ),
);