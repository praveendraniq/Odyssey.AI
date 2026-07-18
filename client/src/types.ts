export type Interest = 'culture' | 'history' | 'food' | 'photography' | 'shopping' | 'nightlife' | 'nature';
export type ItemCategory = 'stay' | 'culture' | 'food' | 'transport' | 'nature' | 'museum' | 'experience';
export type ReplanType = 'late' | 'rain' | 'flight-delay' | 'closed' | 'tired' | 'end-day';

export interface TripRequest { origin?: string; destination: string; departureDate?: string; returnDate?: string; duration: number; travelers: number; budget: number; travelStyle: string; foodPreferences: string[]; interests: Interest[]; }
export interface Traveler { id: string; name: string; initials: string; budgetPreference: string; activityLevel: number; pacePreference: string; foodPreference: string; interests: Record<Interest, number>; phone?: string; }
export interface GroupPreference { interestScores: Record<Interest, number>; recommendedPace: string; explanation: string; groupHappiness?: number; averageHappiness?: number; fairnessPenalty?: number; fairnessGap?: number; }
export interface HappinessBreakdown { interestMatch: number; paceMatch: number; constraintMatch: number; compromiseCoverage: number; }
export interface PreferenceCall { travelerId: string; name: string; phone: string; status: 'completed' | 'queued' | 'dialing' | 'connected' | 'failed' | 'no-answer' | 'canceled'; summary: string; happiness: number; topPriorities: string[]; compromise: string; happinessBreakdown?: HappinessBreakdown; happinessExplanation?: string; dialogue?: Array<{ speaker: 'agent' | 'traveler'; text: string }>; }
export interface PreferenceCollection { adminName: string; adminWeight: number; source: 'mock' | 'vocal-bridge'; calls: PreferenceCall[]; negotiation: string; approvalSummary: string; status?: 'pending' | 'approved'; }
export interface Flight { id: string; airline: string; code: string; departure: string; arrival: string; departureTime: string; arrivalTime: string; price: number; duration: string; stops: number; selected?: boolean; }
export interface Hotel { id: string; name: string; location: string; rating: number; price: number; totalPrice: number; image: string; amenities: string[]; selected?: boolean; }
export interface ItineraryItem { id: string; day: number; time: string; title: string; subtitle: string; category: ItemCategory; durationMins: number; travelMins: number; location: { x: number; y: number }; status: 'completed' | 'current' | 'upcoming' | 'moved' | 'in-progress' | 'skipped' | 'closed'; weatherSensitive?: boolean; openingHours: string; startedAt?: string; completedAt?: string; actualDurationMins?: number; varianceMins?: number; }
export interface TripEvent { id: string; type: ReplanType; title: string; createdAt: string; explanation: string; }
export interface TravelDnaChange { id: string; dimension: 'culture' | 'history' | 'photography' | 'shopping' | 'nightlife' | 'food'; before: number; after: number; reason: string; createdAt: string; }
export interface TravelDna { culture: number; history: number; photography: number; shopping: number; nightlife: number; food: number; learning: string; confidence?: number; changes?: TravelDnaChange[]; }
export interface Budget { total: number; spent: number; remaining: number; flight: number; hotel: number; activities: number; food: number; }
export interface TripProgress { completionPercent: number; scheduleVarianceMins: number; activeStopId?: string; completedStopIds: string[]; skippedStopIds: string[]; lastUpdatedAt?: string; }
export interface ExpenseReceipt { id: string; description: string; category: 'food' | 'transport' | 'activity' | 'other'; amount: number; paidBy: string; participantIds: string[]; splitPercentages?: Record<string, number>; createdAt: string; }
export interface Trip { schemaVersion?: number; id: string; name: string; request: TripRequest; dates: string; travelers: Traveler[]; groupPreference: GroupPreference; flights: Flight[]; hotels: Hotel[]; itinerary: ItineraryItem[]; budget: Budget; travelDna: TravelDna; events: TripEvent[]; progress: number; progressState?: TripProgress; preferenceCollection?: PreferenceCollection; briefTranscript?: string; expenses?: ExpenseReceipt[]; }
export interface PaymentOrder { id: string; status: 'CREATED' | 'COMPLETED'; total: number; currency: 'USD'; split: { travelerId: string; name: string; amount: number }[]; approveUrl?: string; mock: boolean; }
export interface WeatherObservation { location: string; temperatureC: number; condition: string; weatherCode: number; windKph: number; timezone: string; observedAt: string; source: 'google-weather' | 'open-meteo' | 'demo-fallback'; live: boolean; diagnostic?: string; }

export type SpecialistAgentId = 'voice-preference' | 'travel-inventory' | 'itinerary-route' | 'live-operations' | 'commerce' | 'travel-dna';
export type AgentRunStatus = 'running' | 'completed' | 'failed';
export interface AgentDefinition { id: 'journey-coordinator' | SpecialistAgentId; name: string; role: string; tools: string[]; }
export interface AgentStep { id: string; agentId: SpecialistAgentId; agentName: string; task: string; status: AgentRunStatus; startedAt: string; completedAt?: string; durationMs?: number; outputSummary?: string; error?: string; }
export interface AgentRun { id: string; intent: string; status: AgentRunStatus; startedAt: string; completedAt?: string; steps: AgentStep[]; }
export interface AgentSystem { totalAgents: number; coordinator: AgentDefinition; specialists: AgentDefinition[]; recentRuns: AgentRun[]; }
