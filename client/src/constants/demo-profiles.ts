/** Canonical seeded profile used everywhere Sarah appears in the demo. */
export const SARAH_PROFILE = {
  travelerId: 't-sarah',
  pace: 'Moderate walking',
  food: 'Pescetarian food',
  mustDo: 'Early dinner',
  priorities: ['Early dinner', 'Moderate walking', 'Pescetarian food'],
  keepLight: 'Late nights',
  summary: 'Sarah prefers an early dinner, moderate walking, and pescetarian food.',
  compromise: 'Schedule a shared early dinner, then make any late-night activity optional.',
  happiness: 82,
} as const;

export const isSarahProfile = (travelerId: string) => travelerId === SARAH_PROFILE.travelerId;
