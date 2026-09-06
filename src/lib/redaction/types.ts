export type Category =
  | "name"
  | "company"
  | "iban"
  | "address"
  | "email"
  | "phone"
  | "birthdate"
  | "ssn"
  | "creditcard"
  | "custom";

export interface CategoryMeta {
  id: Category;
  label: string;
  placeholder: string;
  description: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: "name", label: "Namen", placeholder: "NAME", description: "Anreden, Vor- und Nachnamen" },
  {
    id: "company",
    label: "Firmen & Organisationen",
    placeholder: "FIRMA",
    description: "GmbH, AG, Vereine, Clubs u. a.",
  },
  { id: "iban", label: "IBAN", placeholder: "IBAN", description: "Mit Prüfziffernkontrolle" },
  { id: "address", label: "Adressen", placeholder: "ADRESSE", description: "Strasse, PLZ und Ort" },
  { id: "email", label: "E-Mail", placeholder: "EMAIL", description: "E-Mail-Adressen" },
  { id: "phone", label: "Telefon", placeholder: "TELEFON", description: "Fest- und Mobilnummern" },
  { id: "birthdate", label: "Geburtsdatum", placeholder: "DATUM", description: "Datumsangaben" },
  { id: "ssn", label: "AHV / SV-Nummer", placeholder: "SV-NR", description: "AHV- und Sozialversicherungsnummern" },
  {
    id: "creditcard",
    label: "Kreditkarte",
    placeholder: "KARTE",
    description: "Kartennummern mit Luhn-Prüfung",
  },
  { id: "custom", label: "Eigene Begriffe", placeholder: "BEGRIFF", description: "Deine eigene Wortliste" },
];

export interface Match {
  id: string;
  category: Category;
  value: string;
  start: number;
  end: number;
  placeholder: string;
}

export type CategoryToggles = Record<Category, boolean>;

export const DEFAULT_TOGGLES: CategoryToggles = {
  name: true,
  company: true,
  iban: true,
  address: true,
  email: true,
  phone: true,
  birthdate: true,
  ssn: true,
  creditcard: true,
  custom: true,
};
