export interface Item {
  id: number;
  name: string;
  item_id: number | null;
  hue: number;
  category_id: number;
  category_name: string;
  description: string;
  usage_count: number;
  is_verified: boolean;
  hues: Array<{
    hue: number;
    description: string;
    usage_count: number;
  }>;
  script_examples: Array<{
    script_id: string;
    script_title: string;
    context: string;
    line_number: number;
  }>;
  // Computed properties
  item_type?: 'id-only' | 'name-only' | 'complete';
  display_name?: string;
  display_id?: string | null;
}

export interface ItemCategory {
  id: number;
  name: string;
}

export interface HueSet {
  id: number;
  name: string;
  hues: Array<{
    hue: number;
    description: string;
  }>;
  usage_count: number;
  created_at: string;
}

export interface IndividualHue {
  hue: number;
  description: string;
  usage_count: number;
}

export interface ScriptExample {
  script_id: string;
  script_title: string;
  context: string;
  line_number: number;
}

export interface CreateItemRequest {
  name: string;
  item_id?: number;
  hue: number;
  category_id: number;
  description: string;
}

export interface UpdateItemRequest {
  name?: string;
  item_id?: number;
  hue?: number;
  category_id?: number;
  description?: string;
}

export interface MergeItemRequest {
  source_item_id: number;
  target_item_id: number;
}

export interface AddHueRequest {
  hue: number;
  description: string;
}

export interface UpdateHueRequest {
  description: string;
}

export interface ItemFilters {
  search: string;
  category_id: number | null;
  matched_only: boolean;
  unmatched_only: boolean;
}

export interface ItemListResponse {
  items: Item[];
  total: number;
  page: number;
  limit: number;
}

export interface ScriptListResponse {
  scripts: ScriptExample[];
  total: number;
  page: number;
  limit: number;
}
