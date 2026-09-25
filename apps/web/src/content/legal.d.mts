export type LegalBlock = string | { list: string[] };
export interface LegalSection { id: string; title: string; body: LegalBlock[] }
export interface LegalDoc { title: string; description: string; updated: string; intro: string[]; sections: LegalSection[] }
export const LEGAL: { privacy: LegalDoc; terms: LegalDoc };
export const SUPPORT_EMAIL: string;
