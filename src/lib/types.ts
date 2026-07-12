export interface ProfileLink {
  label: string;
  url: string;
}

export interface Profile {
  name: string;
  handle: string;
  bio: string;
  avatar: string;
  links: ProfileLink[];
}

export interface Skill {
  name: string;
  keywords: string[];
}

export interface WorkEntry {
  name: string;
  position?: string;
  startDate: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface Resume {
  basics: {
    name: string;
    label: string;
    location: string;
    summary?: string;
  };
  skills: Skill[];
  work: WorkEntry[];
}

export interface PortfolioItem {
  title: string;
  description: string;
  url?: string;
  repo?: string;
  tech: string[];
  year: number;
}

export interface Portfolio {
  works: PortfolioItem[];
}
