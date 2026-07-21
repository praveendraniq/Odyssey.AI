/** Canonical seeded profile used everywhere Friend 1 appears in the demo. */
export const SARAH_PROFILE = {
  travelerId: 't-sarah',
  pace: 'Moderate walking',
  food: 'Pescetarian-friendly meals',
  mustDo: 'Early dinner',
  priorities: ['Historic neighborhoods', 'Early dinner', 'Moderate walking', 'Pescetarian-friendly', 'Quiet evenings'],
  keepLight: 'Late nights',
  summary: 'Sarah prefers historic neighborhoods, an early dinner, pescetarian-friendly meals, moderate walking, and quieter evenings.',
  compromise: 'Keep the shared dinner early, favor moderate walking, and make nightlife optional.',
  happiness: 84,
} as const;

export const isSarahProfile = (travelerId: string) => travelerId === SARAH_PROFILE.travelerId;
