import {
  BadgeCheck,
  Plane,
  Radio,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import type { Timestamp } from "firebase/firestore";

export type ServiceType = "FLIGHT" | "CALL_TIME" | "SHOPPING" | "MWR";
export type RequestStatus = "UNREVIEWED" | "IN PROGRESS" | "OFFICER CONTACTED" | "COMPLETED";
export type AdminProtocolType = "FLIGHT" | "COMMS" | "SHOPPING" | "MWR";
export type ShoppingWeightType = "LIGHT" | "MEDIUM" | "HEAVY";

export interface RequestAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface RequestContactBundle {
  primary_phone?: string;
  alternate_phone?: string;
  primary_email?: string;
  alternate_email?: string;
  preferred_channel?: string;
}

export interface RequestSocialContacts {
  whatsapp?: string;
  telegram?: string;
  signal?: string;
  facebook?: string;
  instagram?: string;
  x?: string;
}

export interface RequestIdentification {
  document_type?: string;
  document_number?: string;
  front_image_url?: string;
  back_image_url?: string;
  front_image_name?: string;
  back_image_name?: string;
}

export interface SupportRequestDocument {
  member_uid?: string;
  member_id?: string;
  member_service_number?: string;
  member_name?: string;
  member_rank?: string;
  member_branch?: string;
  member_unit?: string;
  member_email?: string;
  member_phone?: string;
  requester_name?: string;
  requester_relationship?: string;
  requester_location?: string;
  requester_address?: RequestAddress;
  request_type?: ServiceType;
  request_label?: string;
  urgency_level?: string;
  status?: RequestStatus;
  notes?: string;
  channel?: string;
  handled_by?: string;
  request_timestamp?: Timestamp;
  last_updated?: Timestamp;
  signal_window_initialized_at?: Timestamp;
  signal_window_expires_at?: Timestamp;
  signal_window_memo?: string;
  protocol_selected?: AdminProtocolType;
  protocol_memo?: string;
  protocol_memo_generated_at?: Timestamp;
  shopping_weight?: ShoppingWeightType;
  shopping_amount?: number;
  supply_manifest_items?: string[];
  mwr_donation_amount?: number;
  mwr_impact_label?: string;
  mwr_certificate_name?: string;
  mwr_trust_badge?: string;
  tax_documentation_status?: string;
  contact?: RequestContactBundle;
  social_contacts?: RequestSocialContacts;
  identification?: RequestIdentification;
}

export interface SupportRequestRecord {
  id: string;
  data: SupportRequestDocument;
}

export const SERVICE_OPTIONS: Array<{
  type: ServiceType;
  label: string;
  icon: LucideIcon;
  priorityNote: string;
  prefillTemplate: string;
  contactGuidance: string;
}> = [
  {
    type: "FLIGHT",
    label: "Flight Support",
    icon: Plane,
    priorityNote: "Critical travel coordination lane with elevated logistics handling.",
    prefillTemplate: `Flight Coordination Summary
- Requested travelers:
- Relationship to member:
- Departure city / airport:
- Destination city / airport:
- Preferred departure window:
- Return travel requirement:
- Traveler identification or passport readiness:
- Medical, baggage, or mobility considerations:
- Additional itinerary coordination notes:`,
    contactGuidance:
      "The preferred contact channel selected below will be treated as the primary method the logistics officer should use for verification, itinerary updates, and follow-up communication.",
  },
  {
    type: "CALL_TIME",
    label: "Call Time Purchase",
    icon: Radio,
    priorityNote: "Medium-priority morale and communications support request.",
    prefillTemplate: `Communications Support Summary
- Requested phone or calling service:
- Recipient country / network:
- Requested duration, recharge amount, or package:
- Best activation or delivery window:
- Account, provider, or device details:
- Operational urgency or morale impact:
- Additional coordination notes:`,
    contactGuidance:
      "The preferred contact channel selected below will be used by the logistics officer for service verification, fulfillment updates, and any required clarification before processing.",
  },
  {
    type: "SHOPPING",
    label: "Request Shopping",
    icon: ShoppingCart,
    priorityNote: "Sustainment and personal-item acquisition request pipeline.",
    prefillTemplate: `Procurement Support Summary
- Requested items or categories:
- Brand, size, color, or quantity requirements:
- Preferred vendor or store if applicable:
- Delivery or pickup location:
- Budget ceiling or reimbursement expectation:
- Medical, dietary, or operational necessity:
- Additional fulfillment notes:`,
    contactGuidance:
      "The preferred contact channel selected below is the route the logistics officer should use for substitutions, availability updates, and delivery coordination.",
  },
  {
    type: "MWR",
    label: "MWR Support",
    icon: BadgeCheck,
    priorityNote: "Morale, welfare, and recreation support coordination lane.",
    prefillTemplate: `MWR Coordination Summary
- Requested program, welfare item, or recreational support:
- Intended beneficiary or participating family members:
- Requested date or support window:
- Installation, unit, or location involved:
- Eligibility, sponsorship, or access details:
- Special accommodations or support considerations:
- Additional morale and welfare context:`,
    contactGuidance:
      "The preferred contact channel selected below will guide how the logistics officer initiates outreach for scheduling, eligibility confirmation, and status updates.",
  },
];
