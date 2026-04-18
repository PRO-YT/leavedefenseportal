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
  member_name?: string;
  member_rank?: string;
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
}> = [
  {
    type: "FLIGHT",
    label: "Flight Support",
    icon: Plane,
    priorityNote: "Critical travel coordination lane with elevated logistics handling.",
  },
  {
    type: "CALL_TIME",
    label: "Call Time Purchase",
    icon: Radio,
    priorityNote: "Medium-priority morale and communications support request.",
  },
  {
    type: "SHOPPING",
    label: "Request Shopping",
    icon: ShoppingCart,
    priorityNote: "Sustainment and personal-item acquisition request pipeline.",
  },
  {
    type: "MWR",
    label: "MWR Support",
    icon: BadgeCheck,
    priorityNote: "Morale, welfare, and recreation support coordination lane.",
  },
];
