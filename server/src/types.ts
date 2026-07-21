export type Interest = 'culture' | 'history' | 'food' | 'photography' | 'shopping' | 'nightlife' | 'nature';

export interface TripRequest {
  origin?: string;
  destination: string;
  departureDate?: string;
  returnDate?: string;
  duration: number;
  travelers: number;
  budget: number;
  travelStyle: string;
  foodPreferences: string[];
  interests: Interest[];
}

export interface Traveler {
  id: string;
  name: string;
  initials: string;
  budgetPreference: 'value' | 'balanced' | 'premium';
  activityLevel: 1 | 2 | 3 | 4 | 5;
  pacePreference: 'easy' | 'balanced' | 'full';
  foodPreference: string;
  interests: Record<Interest, number>;
  phone?: string;
  status?: 'pending' | 'ready_to_call' | 'calling' | 'preferences_ready' | 'negotiation_complete' | 'admin_review_needed';
  preferences?: {
    priorities?: string[];
    experience?: string;
    foodRequirements?: string[];
    avoidances?: string[];
    pace?: 'easy' | 'balanced' | 'active';
    summary?: string;
    recommendation?: string;
    matchPercentage?: number;
  };
}

export interface GroupPreference {
  interestScores: Record<Interest, number>;
  recommendedPace: string;
  explanation: string;
  groupHappiness?: number;
  averageHappiness?: number;
  fairnessPenalty?: number;
  fairnessGap?: number;
}

export interface HappinessBreakdown {
  interestMatch: number;
  paceMatch: number;
  constraintMatch: number;
  compromiseCoverage: number;
}

export interface PreferenceCall {
  travelerId: string;
  name: string;
  phone: string;
  status: 'completed' | 'queued' | 'dialing' | 'connected' | 'failed' | 'no-answer' | 'canceled';
  summary: string;
  happiness: number;
  topPriorities: string[];
  compromise: string;
  happinessBreakdown?: HappinessBreakdown;
  happinessExplanation?: string;
  dialogue?: Array<{ speaker: 'agent' | 'traveler'; text: string }>;
}

export interface NegotiationAgreement {
  id: string;
  travelerId: string;
  travelerName: string;
  counterpartId: string;
  counterpartName: string;
  conflict: string;
  rationale: string;
  proposal: string;
  travelerResponse?: string;
  accepted: boolean;
  status: 'calling' | 'accepted' | 'declined' | 'applied';
  affectedDay: number;
  beforeHappiness: number;
  afterHappiness: number;
  agreedChanges: string[];
  preview: Array<{ label: string; before: string; after: string }>;
  itineraryChanges: Array<{ id: string; time: string; title: string; subtitle: string; category: 'food' | 'experience' }>;
  dialogue: Array<{ speaker: 'agent' | 'traveler'; text: string }>;
}

export interface PreferenceCollection {
  adminName: string;
  adminWeight: number;
  source: 'mock' | 'vocal-bridge';
  calls: PreferenceCall[];
  negotiation: string;
  approvalSummary: string;
  status?: 'pending' | 'approved';
  agreement?: NegotiationAgreement;
}

export interface Flight {
  id: string;
  airline: string;
  code: string;
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  duration: string;
  stops: number;
  selected?: boolean;
}

export interface Hotel {
  id: string;
  name: string;
  location: string;
  rating: number;
  price: number;
  totalPrice: number;
  image: string;
  amenities: string[];
  selected?: boolean;
}

export type ItemCategory = 'stay' | 'culture' | 'food' | 'transport' | 'nature' | 'museum' | 'experience';

export interface ItineraryItem {
  id: string;
  day: number;
  time: string;
  title: string;
  subtitle: string;
  category: ItemCategory;
  durationMins: number;
  travelMins: number;
  location: { x: number; y: number };
  status: 'completed' | 'current' | 'upcoming' | 'moved' | 'in-progress' | 'skipped' | 'closed';
  weatherSensitive?: boolean;
  openingHours: string;
  startedAt?: string;
  completedAt?: string;
  actualDurationMins?: number;
  varianceMins?: number;
}

export interface TravelDnaChange {
  id: string;
  dimension: 'culture' | 'history' | 'photography' | 'shopping' | 'nightlife' | 'food';
  before: number;
  after: number;
  reason: string;
  createdAt: string;
}

export interface TripEvent {
  id: string;
  type: 'late' | 'rain' | 'flight-delay' | 'closed' | 'tired';
  title: string;
  createdAt: string;
  explanation: string;
}

export interface TravelDna {
  culture: number;
  history: number;
  photography: number;
  shopping: number;
  nightlife: number;
  food: number;
  learning: string;
  confidence?: number;
  changes?: TravelDnaChange[];
}

export interface TripProgress {
  completionPercent: number;
  scheduleVarianceMins: number;
  activeStopId?: string;
  completedStopIds: string[];
  skippedStopIds: string[];
  lastUpdatedAt?: string;
}

export interface Budget {
  total: number;
  spent: number;
  remaining: number;
  flight: number;
  hotel: number;
  activities: number;
  food: number;
}

export interface ExpenseReceipt {
  id: string;
  description: string;
  category: 'food' | 'transport' | 'activity' | 'other';
  amount: number;
  paidBy: string;
  participantIds: string[];
  splitPercentages?: Record<string, number>;
  createdAt: string;
}

export interface Trip {
  schemaVersion?: number;
  id: string;
  name: string;
  request: TripRequest;
  dates: string;
  travelers: Traveler[];
  groupPreference: GroupPreference;
  flights: Flight[];
  hotels: Hotel[];
  itinerary: ItineraryItem[];
  budget: Budget;
  travelDna: TravelDna;
  events: TripEvent[];
  progress: number;
  progressState?: TripProgress;
  preferenceCollection?: PreferenceCollection;
  briefTranscript?: string;
  expenses?: ExpenseReceipt[];
}

export interface PaymentOrder {
  id: string;
  status: 'CREATED' | 'COMPLETED';
  total: number;
  currency: 'USD';
  split: { travelerId: string; name: string; amount: number }[];
  approveUrl?: string;
  mock: boolean;
}
