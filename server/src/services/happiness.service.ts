import type { HappinessBreakdown, Interest, ItineraryItem, Traveler } from '../types.js';

const dimensions: Interest[] = ['culture', 'history', 'food', 'photography', 'shopping', 'nightlife', 'nature'];

const signalsFor = (item: ItineraryItem): Partial<Record<Interest, number>> => {
  switch (item.category) {
    case 'culture': return { culture: 1, history: 0.75, photography: 0.35 };
    case 'museum': return { culture: 0.8, history: 1, photography: 0.2 };
    case 'food': return { food: 1, culture: 0.2 };
    case 'nature': return { nature: 1, photography: 0.7 };
    case 'experience': return { photography: 0.55, nightlife: 0.35, shopping: 0.25, culture: 0.25 };
    default: return {};
  }
};

export const itineraryInterestScores = (itinerary: ItineraryItem[]): Record<Interest, number> => {
  const minutes = Object.fromEntries(dimensions.map((interest) => [interest, 0])) as Record<Interest, number>;
  for (const item of itinerary.filter((entry) => !['skipped', 'closed'].includes(entry.status))) {
    for (const [interest, weight] of Object.entries(signalsFor(item)) as Array<[Interest, number]>) minutes[interest] += item.durationMins * weight;
  }
  const max = Math.max(...Object.values(minutes), 1);
  return Object.fromEntries(dimensions.map((interest) => [interest, Number((1 + (minutes[interest] / max) * 4).toFixed(2))])) as Record<Interest, number>;
};

export const travelerHappiness = (traveler: Traveler, itinerary: ItineraryItem[], duration: number): { happiness: number; breakdown: HappinessBreakdown; explanation: string } => {
  const plan = itineraryInterestScores(itinerary);
  const weighted = dimensions.reduce((result, interest) => {
    const importance = traveler.interests[interest];
    const match = Math.max(0, 1 - Math.abs(importance - plan[interest]) / 4);
    return { score: result.score + match * importance, weight: result.weight + importance };
  }, { score: 0, weight: 0 });
  const interestMatch = Math.round((weighted.score / Math.max(1, weighted.weight)) * 100);
  const activitiesPerDay = itinerary.filter((item) => !['stay', 'transport'].includes(item.category) && !['skipped', 'closed'].includes(item.status)).length / Math.max(1, duration);
  const target = traveler.pacePreference === 'easy' ? 2 : traveler.pacePreference === 'full' ? 4 : 3;
  const paceMatch = Math.round(Math.max(40, 100 - Math.abs(activitiesPerDay - target) * 22));
  const hasFood = itinerary.some((item) => item.category === 'food' && !['skipped', 'closed'].includes(item.status));
  const constraintMatch = traveler.foodPreference === 'No preference added' ? 90 : hasFood ? 96 : 55;
  const top = dimensions.slice().sort((left, right) => traveler.interests[right] - traveler.interests[left]).slice(0, 2);
  const protectedCount = top.filter((interest) => plan[interest] >= 3).length;
  const compromiseCoverage = protectedCount === 2 ? 100 : protectedCount === 1 ? 70 : 40;
  const breakdown = { interestMatch, paceMatch, constraintMatch, compromiseCoverage };
  const happiness = Math.round(interestMatch * 0.65 + paceMatch * 0.15 + constraintMatch * 0.1 + compromiseCoverage * 0.1);
  return { happiness, breakdown, explanation: `${top.map((interest) => `${interest} ${traveler.interests[interest]}/5`).join(' and ')} are the strongest needs. The current route matches them at ${interestMatch}% with a ${paceMatch}% pace fit.` };
};

export const groupHappiness = (travelers: Traveler[], itinerary: ItineraryItem[], duration: number) => {
  const individual = travelers.map((traveler) => ({ travelerId: traveler.id, ...travelerHappiness(traveler, itinerary, duration) }));
  const scores = individual.map((result) => result.happiness);
  const averageHappiness = Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length));
  const fairnessGap = scores.length ? Math.max(...scores) - Math.min(...scores) : 0;
  const fairnessPenalty = Number((Math.max(0, fairnessGap - 12) * 0.5).toFixed(1));
  return { individual, averageHappiness, fairnessGap, fairnessPenalty, groupHappiness: Math.max(0, Math.round(averageHappiness - fairnessPenalty)) };
};
