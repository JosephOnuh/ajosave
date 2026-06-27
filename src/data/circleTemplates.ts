import { CreateCircleInput } from "@/types/schemas";

export interface CircleTemplate {
  id: string;
  name: string;
  description: string;
  values: CreateCircleInput;
}

export const CIRCLE_TEMPLATES: CircleTemplate[] = [
  {
    id: "family-monthly-ngn",
    name: "Family Monthly",
    description: "₦20,000 · 10 members · Monthly",
    values: {
      name: "Family Monthly Ajo",
      description: "A monthly savings circle for family members to contribute and support each other.",
      contributionAmount: 20000,
      contributionCurrency: "NGN",
      maxMembers: 10,
      cycleFrequency: "monthly",
      circleType: "public",
      gracePeriodHours: 24,
      payoutMethod: "fixed",
    },
  },
  {
    id: "friends-weekly-ngn",
    name: "Friends Weekly",
    description: "₦5,000 · 5 members · Weekly",
    values: {
      name: "Friends Weekly Ajo",
      description: "A friendly weekly savings circle to build financial discipline together.",
      contributionAmount: 5000,
      contributionCurrency: "NGN",
      maxMembers: 5,
      cycleFrequency: "weekly",
      circleType: "public",
      gracePeriodHours: 24,
      payoutMethod: "fixed",
    },
  },
  {
    id: "diaspora-monthly-gbp",
    name: "Diaspora Monthly",
    description: "£100 · 8 members · Monthly",
    values: {
      name: "Diaspora Monthly Ajo",
      description: "A monthly savings circle for friends and family in the diaspora.",
      contributionAmount: 100,
      contributionCurrency: "GBP",
      maxMembers: 8,
      cycleFrequency: "monthly",
      circleType: "public",
      gracePeriodHours: 24,
      payoutMethod: "fixed",
    },
  },
  {
    id: "small-group-biweekly-ngn",
    name: "Small Group",
    description: "₦10,000 · 4 members · Bi-weekly",
    values: {
      name: "Small Group Ajo",
      description: "A small, intimate bi-weekly savings circle.",
      contributionAmount: 10000,
      contributionCurrency: "NGN",
      maxMembers: 4,
      cycleFrequency: "biweekly",
      circleType: "public",
      gracePeriodHours: 24,
      payoutMethod: "fixed",
    },
  },
];
