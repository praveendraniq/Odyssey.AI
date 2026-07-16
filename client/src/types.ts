export type Interest = 'culture' | 'history' | 'food' | 'photography' | 'shopping' | 'nightlife' | 'nature';
export type ItemCategory = 'stay' | 'culture' | 'food' | 'transport' | 'nature' | 'museum' | 'experience';
export type ReplanType = 'late' | 'rain' | 'flight-delay' | 'closed' | 'tired';

export interface TripRequest { destination: string; duration: number; travelers: number; budget: number; travelStyle: string; foodPreferences: string[]; interests: Interest[]; }
export interface Traveler { id: string; name: string; initials: string; budgetPreference: string; activityLevel: number; pacePreference: string; foodPreference: string; interests: Record<Interest, number>; }
export interface GroupPreference { interestScores: Record<Interest, number>; recommendedPace: string; explanation: string; }
export interface PreferenceCall { travelerId: string; name: string; phone: string; status: 'completed' | 'queued'; summary: string; happiness: number; topPriorities: string[]; compromise: string; }
export interface PreferenceCollection { adminName: string; adminWeight: number; source: 'mock' | 'vocal-bridge'; calls: PreferenceCall[]; negotiation: string; approvalSummary: string; status?: 'pending' | 'approved'; }
export interface Flight { id: string; airline: string; code: string; departure: string; arrival: string; departureTime: string; arrivalTime: string; price: number; duration: string; stops: number; selected?: boolean; }
export interface Hotel { id: string; name: string; location: string; rating: number; price: number; totalPrice: number; image: string; amenities: string[]; selected?: boolean; }
export interface ItineraryItem { id: string; day: number; time: string; title: string; subtitle: string; category: ItemCategory; durationMins: number; travelMins: number; location: { x: number; y: number }; status: 'completed' | 'current' | 'upcoming' | 'moved'; weatherSensitive?: boolean; openingHours: string; }
export interface TripEvent { id: string; type: ReplanType; title: string; createdAt: string; explanation: string; }
export interface TravelDna { culture: number; history: number; photography: number; shopping: number; nightlife: number; food: number; learning: string; }
export interface Budget { total: number; spent: number; remaining: number; flight: number; hotel: number; activities: number; food: number; }
export interface Trip { id: string; name: string; request: TripRequest; dates: string; travelers: Traveler[]; groupPreference: GroupPreference; flights: Flight[]; hotels: Hotel[]; itinerary: ItineraryItem[]; budget: Budget; travelDna: TravelDna; events: TripEvent[]; progress: number; preferenceCollection?: PreferenceCollection; }
export interface PaymentOrder { id: string; status: 'CREATED' | 'COMPLETED'; total: number; currency: 'USD'; split: { travelerId: string; name: string; amount: number }[]; approveUrl?: string; mock: boolean; }

export type SpecialistAgentId = 'voice-preference' | 'travel-inventory' | 'itinerary-route' | 'live-operations' | 'commerce' | 'travel-dna';
export type AgentRunStatus = 'running' | 'completed' | 'failed';
export interface AgentDefinition { id: 'journey-coordinator' | SpecialistAgentId; name: string; role: string; tools: string[]; }
export interface AgentStep { id: string; agentId: SpecialistAgentId; agentName: string; task: string; status: AgentRunStatus; startedAt: string; completedAt?: string; durationMs?: number; outputSummary?: string; error?: string; }
export interface AgentRun { id: string; intent: string; status: AgentRunStatus; startedAt: string; completedAt?: string; steps: AgentStep[]; }
export interface AgentSystem { totalAgents: number; coordinator: AgentDefinition; specialists: AgentDefinition[]; recentRuns: AgentRun[]; }
